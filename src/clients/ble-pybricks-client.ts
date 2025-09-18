import noble from '@abandonware/noble';
import { DeviceMetadata } from '.';
import { logDebug } from '../extension/debug-channel';
import { clearPythonErrors } from '../extension/diagnostics';
import { setState, StateProp } from '../logic/state';
import {
    createStartUserProgramCommand,
    createStopUserProgramCommand,
    createWriteStdinCommand,
    createWriteUserProgramMetaCommand,
    createWriteUserRamCommand,
    EventType,
    getEventType,
    parseStatusReport,
    pybricksControlEventCharacteristicUUID,
    pybricksHubCapabilitiesCharacteristicUUID,
    pybricksServiceUUID,
    Status,
    statusToFlag,
} from '../pybricks/protocol';
import { withTimeout } from '../utils/async';
import { BaseClient } from './base-client';

interface Capabilities {
    maxWriteSize: number;
    flags: number;
    maxUserProgramSize: number;
    numOfSlots: number | undefined; // above 1.5.0
}

export class BlePybricksClient extends BaseClient {
    public static readonly devtype = 'ble-pybricks';
    public static readonly devname = 'Pybricks Hub';
    public static readonly supportsModularMpy = true;

    private _rxtxCharacteristic: noble.Characteristic | undefined;
    private _capabilitiesCharacteristic: noble.Characteristic | undefined;
    private _capabilities: Capabilities | undefined;

    constructor() {
        super();
    }

    public get name() {
        return this._device?.peripheral?.advertisement.localName;
    }

    public get connected() {
        return this._device?.peripheral.state === 'connected';
    }

    public get capabilities() {
        return this._capabilities;
    }

    public async disconnect() {
        if (!this.connected || !this._device) return;

        try {
            await this.runExitStack();
            await this._device.peripheral.disconnectAsync();
            this._device = undefined;
        } catch (error) {
            logDebug(`Error during disconnect: ${error}`);
        }
    }

    protected async connectWorker(
        device: DeviceMetadata,
        onDeviceUpdated: (device: DeviceMetadata) => void,
        onDeviceRemoved: (device: DeviceMetadata, name?: string) => void,
    ) {
        const peripheral = device.peripheral;
        await withTimeout(peripheral.connectAsync(), 8000);
        this._exitStack.push(async () => {
            peripheral.removeAllListeners('disconnect');
            onDeviceRemoved &&
                onDeviceRemoved(device, device.peripheral.advertisement.localName);
        });

        peripheral.on('disconnect', async () => {
            if (!this.connected) return;
            logDebug(`Disconnected from ${peripheral?.advertisement.localName}`);
            await clearPythonErrors();
            // Do not call disconnectAsync recursively
            this.runExitStack();
            this._device = undefined;
        });

        this._exitStack.push(async () => {
            this._rxtxCharacteristic?.removeAllListeners('data');
            await this._rxtxCharacteristic?.unsubscribeAsync();
            this._rxtxCharacteristic = undefined;
        });

        const chars = await peripheral.discoverSomeServicesAndCharacteristicsAsync(
            [pybricksServiceUUID],
            [
                pybricksControlEventCharacteristicUUID,
                pybricksHubCapabilitiesCharacteristicUUID,
            ],
        );
        [this._rxtxCharacteristic, this._capabilitiesCharacteristic] =
            chars?.characteristics;
        this._rxtxCharacteristic.on('data', (data) => this.handleIncomingData(data));
        await this._rxtxCharacteristic.subscribeAsync();

        // Read capabilities once connected
        const buf = await this._capabilitiesCharacteristic?.readAsync();
        this._capabilities = buf && {
            maxWriteSize: buf.readUInt16LE(0) ?? 20,
            flags: buf.readUInt32LE(2),
            maxUserProgramSize: buf.readUInt32LE(6),
            numOfSlots: buf.readUInt8(10) ?? 20, // above 1.5.0
        };

        // Repeatedly update RSSI
        const rssiUpdater = setInterval(() => peripheral.updateRssi(), 1000);
        // Notify listeners of RSSI update
        peripheral.on('rssiUpdate', () => onDeviceUpdated && onDeviceUpdated(device));
        this._exitStack.push(async () => {
            clearInterval(rssiUpdater);
            peripheral.removeAllListeners();
        });
    }

    public async write(data: Uint8Array, withoutResponse: boolean = false) {
        await this._rxtxCharacteristic?.writeAsync(Buffer.from(data), withoutResponse);
    }

    protected handleIncomingData(data: Buffer) {
        // this is pybricks specific - move to pybricks client?
        const dataView = new DataView(data.buffer);
        const eventType = getEventType(dataView);
        switch (eventType) {
            case EventType.StatusReport:
                {
                    // process any pending stdout data first
                    this.processStdoutData();

                    // parse status report
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
                    // if stdout data comes in - it means program is running, make sure it is set
                    setState(StateProp.Running, true);

                    // parse and handle stdout data
                    const text = data.toString('utf8', 1, data.length);

                    this.handleWriteStdout(text);
                }
                break;
            default:
                console.warn('Unknown event type:', eventType);
                break;
        }
    }

    public async sendTerminalUserInput(text: string) {
        if (!this.connected) throw new Error('Not connected to a device');
        if (!this._capabilities?.maxWriteSize) return;

        const maxBleWriteSize = this._capabilities.maxWriteSize;
        // assert(maxBleWriteSize >= 20, 'bad maxBleWriteSize');
        const value = text;
        const encoder = new TextEncoder();
        const data = encoder.encode(value);

        for (let i = 0; i < data.length; i += maxBleWriteSize) {
            await this.write(
                createWriteStdinCommand(data.buffer as ArrayBuffer),
                false,
            );
        }
    }

    public async action_start() {
        const slot = 0; // TODO: support multiple programs
        await this.write(createStartUserProgramCommand(slot), false);
    }

    public async action_stop() {
        await this.write(createStopUserProgramCommand(), false);
    }

    public async action_upload(data: Uint8Array, slot?: number, filename?: string) {
        // const packetSize = this._capabilities?.maxWriteSize ?? blob.bytes.length;

        if (
            !this._capabilities ||
            this._capabilities.maxWriteSize === undefined ||
            this._capabilities.maxUserProgramSize === undefined ||
            data.byteLength > this._capabilities?.maxUserProgramSize
        ) {
            throw new Error(
                `User program size (${data.byteLength}) exceeds maximum allowed size (${this._capabilities?.maxUserProgramSize}).`,
            );
        }

        // Pybricks Code sends size 0 to clear the state before sending the new program, then sends the size on completion.
        setState(StateProp.Uploading, true);
        try {
            await this.write(createWriteUserProgramMetaCommand(0), false);
            await this.write(createWriteUserProgramMetaCommand(data.byteLength), false);

            const writeSize = this._capabilities.maxWriteSize - 5; // 5 bytes for the header
            for (let offset = 0; offset < data.byteLength; offset += writeSize) {
                const chunk = data.slice(offset, offset + writeSize);
                const chunkBuffer = chunk.buffer as ArrayBuffer;
                const buffer = createWriteUserRamCommand(offset, chunkBuffer);
                await this.write(buffer, false);
            }
        } catch (error) {
            setState(StateProp.Uploading, false);
            throw error;
        }
        setState(StateProp.Uploading, false);
    }
}
