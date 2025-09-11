import noble, { Peripheral } from '@abandonware/noble';
import _ from 'lodash';
import { delay, isDevelopmentMode } from '../extension';
import { logDebug } from '../extension/debug-channel';
import { clearPythonErrors } from '../extension/diagnostics';
import { setStatusBarItem } from '../extension/statusbar';
import { TreeCommands } from '../extension/tree-commands';
import { ToCapialized } from '../extension/utils';
import {
    EventType,
    getEventType,
    parseStatusReport,
    pbio_gatt_pnp_id_char_uuid,
    pybricksControlEventCharacteristicUUID,
    pybricksHubCapabilitiesCharacteristicUUID,
    pybricksServiceUUID,
    Status,
    statusToFlag,
} from '../pybricks/protocol';
import {
    pybricksDecodeBleBroadcastData,
    PybricksDecodedBleBroadcast,
} from '../pybricks/protocol-ble-broadcast';
import { withTimeout } from '../utils/async';
import Config from '../utils/config';
import { setState, StateProp } from './state';
import { handlePythonError } from './stdout-helper';

export enum BLEStatus {
    Disconnected = 'disconnected',
    Connecting = 'connecting',
    Connected = 'connected',
    Disconnecting = 'disconnecting',
}

const _pybricksServiceUUID = pybricksServiceUUID.replace(/-/g, '').toLowerCase();
const _pbio_gatt_pnp_id_char_uuid = pbio_gatt_pnp_id_char_uuid.toString(16);

export interface DeviceMetadata {
    peripheral: Peripheral;
    lastBroadcast?: PybricksDecodedBleBroadcast;
}

class BLE {
    private device: DeviceMetadata | null = null;
    private pybricksControlChar: noble.Characteristic | null = null;
    private pybricksHubCapabilitiesChar: noble.Characteristic | null = null;
    private _status: BLEStatus = BLEStatus.Disconnected;
    private _allDevices = new Map<string, DeviceMetadata>();
    private _isScanning: boolean = false;
    private exitStack: (() => Promise<void>)[] = [];
    private stdoutBuffer: string = '';
    private stdoutTimer: NodeJS.Timeout | null = null;

    constructor() {
        noble.on('stateChange', async (state) => {
            // state = <"unknown" | "resetting" | "unsupported" | "unauthorized" | "poweredOff" | "poweredOn">
            if (isDevelopmentMode) {
                logDebug(`Noble state changed to: ${state}`);
            }

            if (state === 'scanStart') {
                this._isScanning = true;
                setState(StateProp.Scanning, true);
            } else if (state === 'scanStop') {
                this._isScanning = false;
                setState(StateProp.Scanning, false);
            }
        });
        noble.on('discover', (peripheral) => {
            // Deep copy the advertisement object to avoid mutation issues
            if (!peripheral.advertisement.localName) return;

            const advertisement = _.cloneDeep(
                peripheral.advertisement,
            ) as noble.Advertisement;

            // seenDevices.add(advertisement.localName);
            setTimeout(() => {
                const isMatchingServiceUUID = advertisement.serviceUuids?.some(
                    (uuid) => uuid.toLowerCase() === _pybricksServiceUUID,
                );
                const isMatchingServiceData = advertisement.serviceData?.some(
                    (sd) => sd.uuid.toLowerCase() === _pbio_gatt_pnp_id_char_uuid,
                );

                if (
                    !advertisement.localName ||
                    (!isMatchingServiceUUID && !isMatchingServiceData)
                ) {
                    return;
                }

                const metadata =
                    this._allDevices.get(advertisement.localName) ??
                    (() => {
                        const newMetadata = { peripheral } as DeviceMetadata;
                        this._allDevices.set(advertisement.localName, newMetadata);
                        return newMetadata;
                    })();

                if (isMatchingServiceData) {
                    const manufacturerDataBuffer =
                        peripheral.advertisement.manufacturerData;
                    const decoded =
                        pybricksDecodeBleBroadcastData(manufacturerDataBuffer);
                    metadata.lastBroadcast = decoded;
                }

                this.listeners.forEach((fn) => fn(metadata));
            }, 0);
        });
    }

    public async disconnectAsync() {
        await this.restartScanning();
        if (!this.device) return;
        if (this.status === BLEStatus.Disconnecting) return;
        try {
            this.status = BLEStatus.Disconnecting;
            await this.runExitStack();
            await this.device.peripheral.disconnectAsync();

            // need to delete the device from allDevices so that it can be re-added when scanning
            this.device = null;
            this.status = BLEStatus.Disconnected;
        } catch (error) {
            logDebug(`Error during disconnectAsync: ${error}`);
            this.status = BLEStatus.Disconnected;
        }

        //await this.restartScanning();
        // allow rescan some time
        await delay(500);
    }

    private async runExitStack() {
        for (const fn of this.exitStack) {
            try {
                await fn();
            } catch (error) {
                logDebug(`Error during cleanup function : ${error}`);
            }
        }
        this.exitStack = [];
    }

    public async connectAsync(name: string, onChange?: () => void) {
        // Prevent concurrent connections
        if (this.status === BLEStatus.Connecting)
            throw new Error('Already connecting to a device.');
        if (this.status === BLEStatus.Connected) await this.disconnectAsync();

        // Always cleanup before new connection
        if (this.exitStack.length > 0) await this.runExitStack();

        const metadata = this._allDevices.get(name);
        if (!metadata) throw new Error(`Device ${name} not found.`);
        const peripheral = metadata.peripheral;
        try {
            this.status = BLEStatus.Connecting;
            await withTimeout(
                peripheral
                    .connectAsync()
                    .then(() => peripheral.discoverServicesAsync()),
                8000,
            );

            // Remove any previous listeners
            this.exitStack.push(async () => {
                peripheral.removeAllListeners('disconnect');
            });
            peripheral.on('disconnect', () => {
                if (this.status === BLEStatus.Connected) {
                    logDebug(
                        `Disconnected from ${peripheral?.advertisement.localName}`,
                    );
                    clearPythonErrors();
                    this.status = BLEStatus.Disconnected;
                    // Do not call disconnectAsync recursively
                    this.runExitStack();
                }
                onChange && onChange();
            });

            this.device = metadata;
            this.exitStack.push(async () => {
                this.pybricksControlChar?.removeAllListeners('data');
                await this.pybricksControlChar?.unsubscribeAsync();
                this.pybricksControlChar = null;
            });
            const chars = await peripheral.discoverSomeServicesAndCharacteristicsAsync(
                [pybricksServiceUUID],
                [
                    pybricksControlEventCharacteristicUUID,
                    pybricksHubCapabilitiesCharacteristicUUID,
                ],
            );
            this.pybricksControlChar = chars?.characteristics[0];
            this.pybricksHubCapabilitiesChar = chars?.characteristics[1];
            this.pybricksControlChar.on(
                'data',
                this.handleControlNotification.bind(this),
            );
            await this.pybricksControlChar.subscribeAsync();

            this.status = BLEStatus.Connected;

            this.exitStack.push(async () => {
                // need to remove this as pybricks creates a random BLE id on each reconnect
                if (this.name) this._allDevices.delete(this.name);
                peripheral.removeAllListeners();
            });

            onChange && onChange();
            logDebug(`Connected to ${peripheral.advertisement.localName}`);

            const connectedName = peripheral.advertisement.localName;
            await Config.setLastConnectedDevice(connectedName);
        } catch (error) {
            this.status = BLEStatus.Disconnected;
            await this.runExitStack();
            // restart scanning to make sure the device shows up again
            await this.restartScanning();
            throw new Error(`Failed to connect to ${name}: ${error}`);
        }
    }

    private async restartScanning() {
        await this.stopScanningAsync();
        await this.startScanning();
    }

    private async flushStdoutBuffer() {
        if (this.stdoutBuffer.length > 0) {
            await handlePythonError(this.stdoutBuffer);
            this.stdoutBuffer = '';
        }
        if (this.stdoutTimer) {
            clearTimeout(this.stdoutTimer);
            this.stdoutTimer = null;
        }
    }

    private handleControlNotification(data: Buffer) {
        const dataView = new DataView(data.buffer);
        const eventType = getEventType(dataView);
        switch (eventType) {
            case EventType.StatusReport:
                {
                    this.flushStdoutBuffer();

                    const status = parseStatusReport(dataView);
                    if (status) {
                        const value =
                            (status.flags & statusToFlag(Status.UserProgramRunning)) !==
                            0;
                        setState(StateProp.Running, value);
                    }
                }
                break;
            case EventType.WriteStdout:
                {
                    const text = data.toString('utf8', 1, data.length);

                    logDebug(text, { linebreak: false });

                    this.stdoutBuffer += text;
                    if (this.stdoutTimer) {
                        clearTimeout(this.stdoutTimer);
                    }
                    this.stdoutTimer = setTimeout(() => {
                        this.flushStdoutBuffer();
                    }, 500);
                }
                break;
            default:
                console.warn('Unknown event type:', eventType);
                break;
        }
    }

    public async startScanning() {
        this._allDevices.clear();
        await noble.startScanningAsync([], true);
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

    public async waitForReadyAsync(timeout: number = 10000) {
        return withTimeout(
            new Promise<void>(async (resolve, reject) => {
                noble.once('stateChange', (state) => {
                    if (state === 'poweredOn') {
                        resolve();
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

    public async stopScanningAsync() {
        noble.stopScanning();
    }

    async write(data: Uint8Array, withoutResponse: boolean = false) {
        await this.pybricksControlChar?.writeAsync(Buffer.from(data), withoutResponse);
    }
    async readCapabilities(): Promise<Buffer | undefined> {
        const data = await this.pybricksHubCapabilitiesChar?.readAsync();
        return data;
    }
    public get status() {
        return this._status;
    }

    private set status(newStatus: BLEStatus) {
        setState(StateProp.Connected, newStatus === BLEStatus.Connected);
        setState(StateProp.Connecting, newStatus === BLEStatus.Connecting);

        if (this._status === newStatus) return;
        this._status = newStatus;

        // update status
        const isConnected = newStatus === BLEStatus.Connected;
        setStatusBarItem(
            isConnected,
            (this.name ? this.name + ' ' : '') + ToCapialized(newStatus),
            `Connected to ${this.name} hub.`,
        );
        // vscode.window.setStatusBarMessage(`Connected to ${this.Name} hub.`, 3000);
        // setContextIsConnected(isConnected); // TODO: make this automatic when the status characteristic changes

        TreeCommands.refresh();
    }

    public get current() {
        return this.status === BLEStatus.Connected ? this.device : null;
    }

    public get name() {
        return this.current?.peripheral.advertisement.localName;
    }

    public get isScanning() {
        return this._isScanning;
    }

    public get allDevices() {
        return this._allDevices;
    }

    public getDeviceByName(name: string): DeviceMetadata | undefined {
        return this._allDevices.get(name);
    }
}

export const Device = new BLE();
