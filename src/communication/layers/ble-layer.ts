import {
    type Noble,
    type Peripheral,
    type PeripheralAdvertisement,
} from '@stoprocent/noble';
import _ from 'lodash';
import { ConnectionState, DeviceMetadata } from '..';
import { isDevelopmentMode } from '../../extension';
import { setState, StateProp } from '../../logic/state';
import { pnpIdUUID } from '../../pybricks/ble-device-info-service/protocol';
import { pybricksServiceUUID } from '../../pybricks/ble-pybricks-service/protocol';
import {
    pybricksDecodeBleBroadcastData,
    PybricksDecodedBleBroadcast,
} from '../../pybricks/protocol-ble-broadcast';
import { SPIKE_SERVICE_UUID16 } from '../../spike/protocol';
import Config, { ConfigKeys } from '../../utils/config';
import { HubOSBleClient } from '../clients/hubos-ble-client';
import { PybricksBleClient } from '../clients/pybricks-ble-client';
import { UUIDu } from '../utils';
import { BaseLayer, ConnectionStateChangeEvent, DeviceChangeEvent } from './base-layer';

const ADVERTISEMENT_POLL_INTERVAL = 1000; // ms
const DEFAULT_BLE_DEVICE_VISIBILITY = 10000; // ms

export class DeviceMetadataWithPeripheral extends DeviceMetadata {
    constructor(
        public devtype: string,
        public peripheral: Peripheral,
        public lastBroadcast?: PybricksDecodedBleBroadcast,
    ) {
        super(devtype);
    }

    public get rssi(): number | undefined {
        return this.peripheral.rssi;
    }

    public get broadcastAsString(): string | undefined {
        return this.lastBroadcast ? JSON.stringify(this.lastBroadcast) : undefined;
    }

    public get name(): string | undefined {
        return this.peripheral.advertisement.localName;
    }
}

export class BLELayer extends BaseLayer {
    public static readonly name: string = 'ble-layer';
    private _isScanning: boolean = false;
    private _advertisementQueue: Map<
        string,
        {
            peripheral: Peripheral;
            devtype: string;
            advertisement: PeripheralAdvertisement;
        }
    > = new Map();
    private _advertisementHandle: NodeJS.Timeout | undefined = undefined;
    private _noble: Noble | undefined = undefined;

    public supportsDevtype(_devtype: string) {
        return (
            PybricksBleClient.devtype === _devtype ||
            HubOSBleClient.devtype === _devtype
        );
    }

    constructor(
        onStateChange?: (event: ConnectionStateChangeEvent) => void,
        onDeviceChange?: (device: DeviceChangeEvent) => void,
    ) {
        super(onStateChange, onDeviceChange);
    }

    public async initialize() {
        // throw new Error('Noble import not supported');
        const nobleModule = await import('@stoprocent/noble');
        this._noble = nobleModule?.withBindings('default'); // 'hci', 'win', 'mac'
        if (!this._noble) throw new Error('Noble module not loaded');

        this.state = ConnectionState.Disconnected; // initialized successfully

        // setup noble listeners
        this._noble.on(
            'stateChange',
            (state) => void this.handleNobleStateChange(state),
        );
        this._noble.on('scanStart', () => {
            this._isScanning = true;
            setState(StateProp.Scanning, true);
            this._advertisementHandle = setInterval(
                () => this.processAdvertisementQueue(),
                ADVERTISEMENT_POLL_INTERVAL,
            );
        });
        this._noble.on('scanStop', () => {
            this._isScanning = false;
            clearInterval(this._advertisementHandle);
            this._advertisementHandle = undefined;
        });
        this._noble.on('discover', (peripheral) => {
            if (!peripheral.advertisement.localName) return;

            const advertisement = _.cloneDeep(peripheral.advertisement);

            // Identify device type and id
            const isPybricks = advertisement.serviceUuids?.includes(
                UUIDu.to128(pybricksServiceUUID),
            );
            const isSpike = advertisement.serviceUuids?.includes(
                UUIDu.to16(SPIKE_SERVICE_UUID16),
            );
            const isPybricksAdv = advertisement.serviceData.some(
                (sd) => UUIDu.to16(pnpIdUUID) === sd.uuid,
            );

            if (
                !advertisement.localName ||
                (!isPybricks && !isSpike && !isPybricksAdv)
            ) {
                return;
            }

            const devtype =
                isPybricks || isPybricksAdv
                    ? PybricksBleClient.devtype
                    : HubOSBleClient.devtype;
            const targetid = DeviceMetadataWithPeripheral.generateId(
                devtype,
                advertisement.localName,
            );

            // Add to queue, replacing any previous advertisement for this device
            this._advertisementQueue.set(targetid, {
                peripheral,
                devtype,
                advertisement,
            });
        });
    }

    private processAdvertisementQueue() {
        // Debounce: process only the last advertisement after a short delay
        for (const [targetid, { peripheral, devtype, advertisement }] of this
            ._advertisementQueue) {
            this._advertisementQueue.delete(targetid);
            this.processAdvertisement(targetid, devtype, peripheral, advertisement);
        }
    }

    private processAdvertisement(
        targetid: string,
        devtype: string,
        peripheral: Peripheral,
        advertisement: PeripheralAdvertisement,
    ) {
        const metadata: DeviceMetadataWithPeripheral =
            (this._allDevices.get(targetid) as DeviceMetadataWithPeripheral) ??
            (() => {
                const newMetadata = new DeviceMetadataWithPeripheral(
                    devtype,
                    peripheral,
                    undefined,
                );
                this._allDevices.set(targetid, newMetadata);
                return newMetadata;
            })();

        // only update on (passive) advertisement data
        const isPybricksAdv = advertisement.serviceData
            ?.map((sd) => sd?.uuid)
            .includes(UUIDu.to16(pnpIdUUID));
        if (isPybricksAdv) {
            const manufacturerDataBuffer = advertisement.manufacturerData;
            const decoded = pybricksDecodeBleBroadcastData(manufacturerDataBuffer);
            metadata.lastBroadcast = decoded;
        } else {
            // ?? clear lastBroadcast
        }

        // update the validTill value
        metadata.validTill =
            Date.now() +
            Config.getConfigValue<number>(
                ConfigKeys.DeviceVisibilityTimeout,
                DEFAULT_BLE_DEVICE_VISIBILITY,
            );
        this._deviceChange.fire({ metadata });
        return metadata;
    }

    private handleNobleStateChange(state: string) {
        // state = <"unknown" | "resetting" | "unsupported" | "unauthorized" | "poweredOff" | "poweredOn">

        if (isDevelopmentMode) {
            console.log(`Noble state changed to: ${state}`);
            // TODO: handle disconnect and restart scanning!
        }
        if (state === 'poweredOn') {
            void this.restartScanning();
        }
    }

    public async connect(id: string, devtype: string): Promise<void> {
        const metadata = this._allDevices.get(id);
        if (!metadata) throw new Error(`Device ${id} not found.`);

        switch (metadata.devtype) {
            case PybricksBleClient.devtype:
                BaseLayer.activeClient = new PybricksBleClient(metadata, this);
                break;
            case HubOSBleClient.devtype:
                BaseLayer.activeClient = new HubOSBleClient(metadata, this);
                break;
            default:
                throw new Error(`Unknown device type: ${metadata.devtype}`);
        }

        await super.connect(id, devtype);
    }

    public async disconnect() {
        await super.disconnect();
    }

    private restartScanning() {
        this.stopScanning();
        void this.startScanning();
    }

    public async startScanning() {
        this._allDevices.clear();

        // if there is an active connection, re-add it to keep the reference
        if (BaseLayer.activeClient?.connected && BaseLayer.activeClient.metadata) {
            this._allDevices.set(
                BaseLayer.activeClient.metadata.id,
                BaseLayer.activeClient.metadata,
            );
        }

        await this._noble?.startScanningAsync(
            // undefined,
            undefined,
            // [
            //     pybricksServiceUUID, // pybricks connect uuid
            //     uuid128(pnpIdUUID), // pybricks advertisement uuid
            //     SPIKE_SERVICE_UUID, // spike prime connect uuid
            //     '0000fd02-0000-1000-8000-00805f9b34fb',
            //     'fd02', // spike prime connect uuid (short)
            // ],
            // TODO: on windows short UUIDs do not work, check if this is still the case
            true,
        );
    }

    public waitForReadyPromise(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (this._noble?.state === 'poweredOn') {
                this.state = ConnectionState.Disconnected; // initialized successfully
                resolve();
                return;
            }
            this._noble?.once('stateChange', (state) => {
                if (state === 'poweredOn') {
                    this.state = ConnectionState.Disconnected; // initialized successfully
                    resolve();
                } else {
                    reject(new Error(`BLE state changed to ${state}, not poweredOn`));
                }
            });
        });
    }

    public stopScanning() {
        this._noble?.stopScanning();
    }

    public get scanning() {
        return this._isScanning;
    }

    public get allDevices() {
        return this._allDevices;
    }
}
