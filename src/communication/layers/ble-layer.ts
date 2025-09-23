import noble, { Peripheral } from '@abandonware/noble';
import _ from 'lodash';
import { DeviceMetadata } from '..';
import { isDevelopmentMode } from '../../extension';
import { setState, StateProp } from '../../logic/state';
import { pnpIdUUID } from '../../pybricks/ble-device-info-service/protocol';
import { pybricksServiceUUID } from '../../pybricks/ble-pybricks-service/protocol';
import {
    pybricksDecodeBleBroadcastData,
    PybricksDecodedBleBroadcast,
} from '../../pybricks/protocol-ble-broadcast';
import { SPIKE_SERVICE_UUID16 } from '../../spike/protocol';
import { withTimeout } from '../../utils/async';
import { HubOSBleClient } from '../clients/hubos-ble-client';
import { PybricksBleClient } from '../clients/pybricks-ble-client';
import { uuid128, uuid16 } from '../utils';
import { BaseLayer } from './base-layer';

const BLE_DEVICE_VISIBILITY_TIMEOUT = 10000; // milliseconds

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
    private _isScanning: boolean = false;

    public supportsDevtype(_devtype: string) {
        return (
            PybricksBleClient.devtype === _devtype ||
            HubOSBleClient.devtype === _devtype
        );
    }

    constructor() {
        super();

        // setup noble listeners
        noble.on('stateChange', (state) => void this.handleStateChange(state));
        noble.on('scanStart', () => {
            this._isScanning = true;
            setState(StateProp.Scanning, true);
        });
        noble.on('scanStop', () => {
            this._isScanning = false;
            setState(StateProp.Scanning, false);
        });
        noble.on('discover', (peripheral) => {
            // Deep copy the advertisement object to avoid mutation issues
            if (!peripheral.advertisement.localName) return;

            const advertisement = _.cloneDeep(peripheral.advertisement);

            // seenDevices.add(advertisement.localName);
            // setTimeout(() => {
            //!! todo optimize to align with BleLayer
            const isPybricks = advertisement.serviceUuids?.includes(
                uuid128(pybricksServiceUUID),
            );
            const isSpike = advertisement.serviceUuids?.includes(
                uuid16(SPIKE_SERVICE_UUID16),
            );
            const isPybricksAdv = advertisement.serviceData
                ?.map((sd) => sd?.uuid)
                .includes(uuid16(pnpIdUUID));

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
            const targetId = DeviceMetadataWithPeripheral.generateId(
                devtype,
                advertisement.localName,
            );
            const metadata =
                this._allDevices.get(targetId) ??
                (() => {
                    const newMetadata = new DeviceMetadataWithPeripheral(
                        devtype,
                        peripheral,
                        undefined,
                    );
                    newMetadata.validTill = Date.now() + BLE_DEVICE_VISIBILITY_TIMEOUT;
                    this._allDevices.set(targetId, newMetadata);
                    return newMetadata;
                })();

            // only update on (passive) advertisement data
            if (isPybricksAdv) {
                const manufacturerDataBuffer =
                    peripheral.advertisement.manufacturerData;
                const decoded = pybricksDecodeBleBroadcastData(manufacturerDataBuffer);
                (metadata as DeviceMetadataWithPeripheral).lastBroadcast = decoded;
            }

            this._listeners.forEach((fn) => fn(metadata));
            // }, 0);
        });
    }

    private handleStateChange(state: string) {
        // state = <"unknown" | "resetting" | "unsupported" | "unauthorized" | "poweredOff" | "poweredOn">

        if (isDevelopmentMode) {
            console.log(`Noble state changed to: ${state}`);
            // TODO: handle disconnect and restart scanning!
        }
        if (state === 'poweredOn' && this._isStartedUp) {
            void this.restartScanning();
        }
    }

    public async startup() {
        await super.startup();

        if (noble._state === 'poweredOn') {
            await this.restartScanning();
        }
    }

    public async connect(name: string, devtype: string): Promise<void> {
        const metadata = this._allDevices.get(name);
        if (!metadata) throw new Error(`Device ${name} not found.`);

        switch (metadata.devtype) {
            case PybricksBleClient.devtype:
                this._client = new PybricksBleClient(metadata);
                break;
            case HubOSBleClient.devtype:
                this._client = new HubOSBleClient(metadata);
                break;
            default:
                throw new Error(`Unknown device type: ${metadata.devtype}`);
        }

        await super.connect(name, devtype);
    }

    public async disconnect() {
        await super.disconnect();

        await this.restartScanning();
    }

    private async restartScanning() {
        this.stopScanning();
        await this.startScanning();
    }

    public async startScanning() {
        this._allDevices.clear();
        await noble.startScanningAsync(
            [
                pybricksServiceUUID, // pybricks connect uuid
                uuid128(pnpIdUUID), // pybricks advertisement uuid
                uuid128(SPIKE_SERVICE_UUID16), // spike prime connect uuid
            ],
            true,
        );
    }

    public waitForReadyAsync(timeout: number = 10000): Promise<void> {
        return withTimeout(
            new Promise<void>((resolve, reject) => {
                if (noble._state === 'poweredOn') {
                    resolve();
                    return;
                }
                noble.once('stateChange', (state) => {
                    if (state === 'poweredOn') {
                        resolve();
                    } else {
                        reject(
                            new Error(`BLE state changed to ${state}, not poweredOn`),
                        );
                    }
                });
            }),
            timeout,
        );
    }

    public stopScanning() {
        noble.stopScanning();
    }

    public get isScanning() {
        return this._isScanning;
    }

    public get allDevices() {
        return this._allDevices;
    }
}
