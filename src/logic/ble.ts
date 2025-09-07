import noble, { Peripheral } from '@abandonware/noble';
import {
    setContextIsConnected,
    setContextIsProgramRunning,
} from '../extension/context-utils';
import { logDebug } from '../extension/debug-channel';
import { clearPythonErrors, reportPythonError } from '../extension/diagnostics';
import { setStatusBarItem } from '../extension/statusbar';
import { TreeCommands } from '../extension/tree-commands';
import {
    EventType,
    getEventType,
    parseStatusReport,
    pybricksControlEventCharacteristicUUID,
    pybricksHubCapabilitiesCharacteristicUUID,
    pybricksServiceUUID,
    Status,
    statusToFlag,
} from '../pybricks/protocol';
import { retryWithTimeout } from '../utils/async';
import Config from '../utils/config';
import { ToCapialized } from '../extension/utils';

export enum BLEStatus {
    Disconnected = 'disconnected',
    Connecting = 'connecting',
    Connected = 'connected',
    Disconnecting = 'disconnecting',
    Error = 'error',
}

class BLE {
    private pybricksControlChar: noble.Characteristic | null = null;
    private pybricksHubCapabilitiesChar: noble.Characteristic | null = null;

    constructor(
        private device: Peripheral | null = null,
        private status: BLEStatus = BLEStatus.Disconnected,
        private allDevices: { [localName: string]: Peripheral } = {},
        private isProgramRunning: boolean = false,
        private isScanning: boolean = false,
    ) {}

    private exitStack: (() => void)[] = [];
    private stdoutBuffer: string = '';
    private stdoutTimer: NodeJS.Timeout | null = null;

    public async disconnectAsync() {
        if (this.device && this.device.state === 'connected') {
            try {
                this.Status = BLEStatus.Disconnecting;
                await this.device.disconnectAsync();
                this.exitStack.forEach((fn) => fn());
                this.Status = BLEStatus.Disconnected;
            } catch (error) {
                this.Status = BLEStatus.Error;
            }
        }
    }

    public async connectAsync(name: string, onChange?: () => void) {
        if (this.Status !== BLEStatus.Disconnected && this.Status !== BLEStatus.Error) {
            return;
        }

        const peripheral = this.allDevices[name];
        if (!peripheral) {
            throw new Error(`Device ${name} not found.`);
        }

        try {
            this.Status = BLEStatus.Connecting;
            await retryWithTimeout(async () => {
                await peripheral.connectAsync();
                await peripheral.discoverServicesAsync([pybricksServiceUUID]);
            });
            peripheral.on('disconnect', () => {
                if (this.Status === BLEStatus.Connected) {
                    logDebug(
                        `Disconnected from ${peripheral?.advertisement.localName}`,
                    );
                    clearPythonErrors();
                    this.Status = BLEStatus.Disconnected;
                }
                onChange && onChange();
            });
            this.device = peripheral;

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
            this.exitStack.push(() => {
                this.pybricksControlChar?.removeAllListeners('data');
                this.pybricksControlChar?.unsubscribe();
                this.pybricksControlChar = null;
            });

            this.Status = BLEStatus.Connected;
            onChange && onChange();
            logDebug(`Connected to ${peripheral.advertisement.localName}`);

            const connectedName = peripheral.advertisement.localName;
            await Config.setLastConnectedDevice(connectedName);
        } catch (error) {
            this.Status = BLEStatus.Error;
            throw new Error(`Failed to connect to ${name}: ${error}`);
        }
    }

    private async handlePythonError(text: string) {
        /*
            Find the traceback block:
            Traceback (most recent call last):
              File "__main__.py", line 9, in <module>
              File "test1.py", line 9, in <module>
            NameError: name 'PrimeHub2' isn't defined
        */
        const lines = text.split(/\r?\n/);
        let start = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('Traceback (most recent call last):')) {
                start = i;
                break;
            }
        }
        if (start === -1) {
            return;
        }
        // Collect traceback lines
        let end = start + 1;
        while (
            end < lines.length &&
            /^\s+File ".+", line \d+, in .+/.test(lines[end])
        ) {
            end++;
        }
        // The error message is the next non-empty, non-indented line
        while (end < lines.length && lines[end].trim() === '') {
            end++;
        }
        if (end >= lines.length) {
            return;
        }

        const errorMsg = lines[end].trim();
        // Find the last stack frame
        let filename = '';
        let line = 0;
        for (let i = end - 1; i > start; i--) {
            const match = /^\s+File "([^"]+)", line (\d+), in .+/.exec(lines[i]);
            if (match) {
                filename = match[1];
                line = parseInt(match[2], 10) - 1;
                break;
            }
        }
        if (!filename || !errorMsg) {
            return;
        }

        await reportPythonError(filename, line, errorMsg);
    }

    private async flushStdoutBuffer() {
        if (this.stdoutBuffer.length > 0) {
            await this.handlePythonError(this.stdoutBuffer);
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
                        if (this.isProgramRunning !== value) {
                            setContextIsProgramRunning(value);
                            TreeCommands.refresh();
                        }
                        this.isProgramRunning = value;
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

    public async startScanningAsync(onDiscover?: (peripheral: Peripheral) => void) {
        this.allDevices = {};
        await retryWithTimeout(
            async () => {
                await this.startScanningOnceAsync(onDiscover);
            },
            async () => {
                try {
                    await this.stopScanningAsync();
                } catch (error) {
                    console.error(error);
                }
            },
        );
    }

    private async startScanningOnceAsync(
        onDiscover?: (peripheral: Peripheral) => void,
    ) {
        if (this.isScanning) {
            await this.stopScanningAsync();
        }

        this.isScanning = true;
        if (
            this.Status === BLEStatus.Connecting ||
            this.Status === BLEStatus.Disconnecting
        ) {
            return;
        }
        this.allDevices = {};
        noble.on('discover', (peripheral) => {
            const { localName, serviceUuids } = peripheral.advertisement;
            if (!localName || localName in this.allDevices) {
                return;
            }

            if (
                !serviceUuids ||
                !serviceUuids.some(
                    (uuid) =>
                        uuid.replace(/-/g, '').toLowerCase() ===
                        pybricksServiceUUID.replace(/-/g, '').toLowerCase(),
                )
            ) {
                return;
            }

            this.allDevices[localName] = peripheral;

            if (onDiscover) {
                onDiscover(peripheral);
            }
        });
        await noble.startScanningAsync([], true);

        while (Object.keys(this.allDevices).length === 0 && this.isScanning) {
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
        // keep scanning for a while to find more devices?
    }

    public async stopScanningAsync() {
        if (this.isScanning) {
            noble.removeAllListeners('discover');
            noble.stopScanning();
            this.isScanning = false;
        }
    }

    async write(data: Uint8Array, withoutResponse: boolean = false) {
        await this.pybricksControlChar?.writeAsync(Buffer.from(data), withoutResponse);
    }
    async readCapabilities(): Promise<Buffer | undefined> {
        if (!this.pybricksHubCapabilitiesChar) {
            return undefined;
        }

        const data = await this.pybricksHubCapabilitiesChar.readAsync();
        return data;
    }
    public get Status() {
        return this.status;
    }

    private set Status(newStatus: BLEStatus) {
        if (this.status === newStatus) {
            return;
        }
        this.status = newStatus;

        // update status
        const isDisconnected = newStatus === BLEStatus.Disconnected;
        setStatusBarItem(
            !isDisconnected,
            (Device.Name ? Device.Name + ' ' : '') + ToCapialized(newStatus),
            `Connected to ${Device.Name} hub.`,
        );
        // vscode.window.setStatusBarMessage(`Connected to ${Device.Name} hub.`, 3000);
        setContextIsConnected(isDisconnected);

        if (newStatus === BLEStatus.Error) {
            // showError('An error occurred with the Bluetooth connection.');
        }

        TreeCommands.refresh();
    }

    public get Current() {
        return this.Status === BLEStatus.Connected ? this.device : null;
    }

    public get Name() {
        return this.Current?.advertisement.localName;
    }

    public get IsProgramRunning() {
        return this.isProgramRunning;
    }
    public get IsScanning() {
        return this.isScanning;
    }

    public get AllDevices() {
        return this.allDevices;
    }
}

export const Device = new BLE();
