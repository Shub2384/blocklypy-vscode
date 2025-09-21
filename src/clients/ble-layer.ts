import noble from '@abandonware/noble';
import _ from 'lodash';
import { DeviceMetadata } from '.';
import { isDevelopmentMode } from '../extension';
import { setState, StateProp } from '../logic/state';
import { pnpIdUUID } from '../pybricks/ble-device-info-service/protocol';
import { pybricksServiceUUID } from '../pybricks/ble-pybricks-service/protocol';
import { pybricksDecodeBleBroadcastData } from '../pybricks/protocol-ble-broadcast';
import { SPIKE_SERVICE_UUID16 } from '../spike/protocol';
import { withTimeout } from '../utils/async';
import { BaseLayer } from './base-layer';
import { BlePybricksClient } from './ble-pybricks-client';
import { BleSpikeClient } from './ble-spike-client';
import { uuid128, uuid16 } from './utils';

export class BLELayer extends BaseLayer {
    private _isScanning: boolean = false;

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

            const metadata =
                this._allDevices.get(advertisement.localName) ??
                (() => {
                    const devtype =
                        isPybricks || isPybricksAdv
                            ? BlePybricksClient.devtype
                            : BleSpikeClient.devtype;

                    const newMetadata = {
                        devtype,
                        peripheral,
                        lastBroadcast: undefined,
                    } as DeviceMetadata;
                    this._allDevices.set(advertisement.localName, newMetadata);
                    return newMetadata;
                })();

            // only update on (passive) advertisement data
            if (isPybricksAdv) {
                const manufacturerDataBuffer =
                    peripheral.advertisement.manufacturerData;
                const decoded = pybricksDecodeBleBroadcastData(manufacturerDataBuffer);
                metadata.lastBroadcast = decoded;
            }

            this.listeners.forEach((fn) => fn(metadata));
            // }, 0);
        });
    }

    private handleStateChange(state: string) {
        // state = <"unknown" | "resetting" | "unsupported" | "unauthorized" | "poweredOff" | "poweredOn">

        if (isDevelopmentMode) {
            console.log(`Noble state changed to: ${state}`);
            // TODO: handle disconnect and restart scanning!
        }
        if (state === 'poweredOn') {
            this.restartScanning().catch(console.error);
        }
    }

    public async connect(name: string): Promise<void> {
        const metadata = this._allDevices.get(name);
        if (!metadata) throw new Error(`Device ${name} not found.`);

        switch (metadata.devtype) {
            case BlePybricksClient.devtype:
                this._client = new BlePybricksClient();
                break;
            case BleSpikeClient.devtype:
                this._client = new BleSpikeClient();
                break;
            default:
                throw new Error(`Unknown device type: ${metadata.devtype}`);
        }

        await super.connect(name);
    }

    public async disconnect() {
        await this.restartScanning();
        await super.disconnect();
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

    // add listeners here and not on noble
    private listeners: ((device: DeviceMetadata) => void)[] = [];
    public addListener(fn: (device: DeviceMetadata) => void) {
        if (this.listeners.indexOf(fn) === -1) {
            this.listeners.push(fn);
        }
    }
    public removeListener(fn: (device: DeviceMetadata) => void) {
        const idx = this.listeners.indexOf(fn);
        if (idx !== -1) {
            this.listeners.splice(idx, 1);
        }
    }

    public waitForReadyAsync(timeout: number = 10000) {
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

    public async waitTillDeviceAppearsAsync(
        name: string,
        timeout: number = 10000,
    ): Promise<string> {
        const start = Date.now();
        return new Promise<string>((resolve, reject) => {
            if (this._allDevices.has(name)) {
                resolve(name);
                return;
            }

            withTimeout(
                new Promise<string>((res, rej) => {
                    const listener = (device: DeviceMetadata) => {
                        if (device.peripheral.advertisement.localName === name) {
                            this.removeListener(listener);
                            res(name);
                        } else if (Date.now() - start > timeout) {
                            this.removeListener(listener);
                            rej(new Error('Timeout waiting for device'));
                        }
                    };
                    this.addListener(listener);
                }),
                timeout,
            )
                .then((value) => resolve(value as string))
                .catch(reject);
        });
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

export const bleLayer = new BLELayer();
