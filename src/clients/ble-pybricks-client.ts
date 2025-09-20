import noble from '@abandonware/noble';
import semver from 'semver';
import { DeviceMetadata } from '.';
import { handleDeviceNotification } from '../logic/appdata-devicenotification-helper';
import { setState, StateProp } from '../logic/state';
import {
    decodePnpId,
    deviceInformationServiceUUID,
    firmwareRevisionStringUUID,
    getHubTypeName,
    PnpId,
    pnpIdUUID,
    softwareRevisionStringUUID,
} from '../pybricks/ble-device-info-service/protocol';
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
} from '../pybricks/ble-pybricks-service/protocol';
import {
    checkIsDeviceNotification,
    parseDeviceNotificationPayloads,
} from '../spike/utils/device-notification';
import { BleBaseClient } from './ble-base-client';
import { uuid128, uuidStr } from './utils';

interface Capabilities {
    maxWriteSize: number;
    flags: number;
    maxUserProgramSize: number;
    numOfSlots: number | undefined; // above 1.5.0
}

interface VersionInfo {
    firmware: string;
    software: string;
    pnpId: PnpId;
}

export class BlePybricksClient extends BleBaseClient {
    public static readonly devtype = 'pybricks-ble';
    public static readonly devname = 'Pybricks on BLE';
    public static readonly supportsModularMpy = true;

    private _rxtxCharacteristic: noble.Characteristic | undefined;
    private _capabilitiesCharacteristic: noble.Characteristic | undefined;
    private _capabilities: Capabilities | undefined;
    private _version: VersionInfo | undefined;

    constructor() {
        super();
    }

    public get name() {
        return this._device?.peripheral?.advertisement.localName;
    }

    public get description() {
        const osType = 'Pybricks';
        return `${
            this._version ? getHubTypeName(this._version?.pnpId) : 'Unknown hub'
        } with ${osType} firmware: ${this._version?.firmware}, software: ${
            this._version?.software
        }`;
    }

    public get connected() {
        return this._device?.peripheral.state === 'connected';
    }

    public get capabilities() {
        return this._capabilities;
    }

    protected async connectWorker(
        device: DeviceMetadata,
        onDeviceUpdated: (device: DeviceMetadata) => void,
        onDeviceRemoved: (device: DeviceMetadata, name?: string) => void,
    ) {
        await super.connectWorker(device, onDeviceUpdated, onDeviceRemoved);

        const peripheral = device.peripheral;
        // await peripheral.connectAsync();
        // this._exitStack.push(async () => {
        //     peripheral.removeAllListeners('disconnect');
        //     onDeviceRemoved &&
        //         onDeviceRemoved(device, device.peripheral.advertisement.localName);
        // });

        // peripheral.on('disconnect', async () => {
        //     if (!this.connected) return;
        //     logDebug(`Disconnected from ${peripheral?.advertisement.localName}`);
        //     await clearPythonErrors();
        //     // Do not call disconnectAsync recursively
        //     this.runExitStack();
        //     this._device = undefined;
        // });

        const discoveredServicesandCharacterisitics =
            await peripheral.discoverSomeServicesAndCharacteristicsAsync(
                [pybricksServiceUUID, uuid128(deviceInformationServiceUUID)],
                [
                    pybricksControlEventCharacteristicUUID,
                    pybricksHubCapabilitiesCharacteristicUUID,

                    firmwareRevisionStringUUID,
                    softwareRevisionStringUUID,
                    pnpIdUUID,
                ].map((uuid16) => uuidStr(uuid16)),
            );

        const [pybricksService, deviceInfoService] =
            discoveredServicesandCharacterisitics.services;
        const [
            pybricksControlChar,
            pybricksHubCapabilitiesChar,
            firmwareChar,
            softwareChar,
            pnpIdChar,
        ] = discoveredServicesandCharacterisitics.characteristics;
        // const findChar = (uuid: string | number) =>
        //     characteristics.find((c) => equalUuids(c.uuid, uuid));

        const firmwareRevision = (await firmwareChar.readAsync()).toString('utf8');
        const softwareRevision = (await softwareChar.readAsync()).toString('utf8');
        const pnpId = decodePnpId(new DataView((await pnpIdChar.readAsync()).buffer));
        this._version = {
            firmware: firmwareRevision,
            software: softwareRevision,
            pnpId,
        };

        this._exitStack.push(async () => {
            this._rxtxCharacteristic?.removeAllListeners('data');
            await this._rxtxCharacteristic?.unsubscribeAsync();
            this._rxtxCharacteristic = undefined;
        });

        this._rxtxCharacteristic = pybricksControlChar;
        this._rxtxCharacteristic.on(
            'data',
            async (data) => await this.handleIncomingData(data),
        );
        await this._rxtxCharacteristic.subscribeAsync();

        // Read capabilities once connected
        if (semver.satisfies(softwareRevision, '^1.2.0')) {
            this._capabilitiesCharacteristic = pybricksHubCapabilitiesChar;
            const buf = await this._capabilitiesCharacteristic?.readAsync();
            this._capabilities = buf && {
                maxWriteSize: buf.readUInt16LE(0) ?? 20,
                flags: buf.readUInt32LE(2),
                maxUserProgramSize: buf.readUInt32LE(6),
                numOfSlots: semver.satisfies(softwareRevision, '^1.5.0')
                    ? buf.readUInt8(10)
                    : undefined, // above 1.5.0
            };
        }

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

    protected async handleIncomingData(data: Buffer) {
        // this is pybricks specific - move to pybricks client?
        const dataView = new DataView(data.buffer);
        const eventType = getEventType(dataView);
        switch (eventType) {
            case EventType.StatusReport:
                {
                    // process any pending stdout data first
                    await this.processStdoutData();

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
                setState(StateProp.Running, true);
                await this.handleWriteStdout(data.toString('utf8', 1, data.length));
                break;
            case EventType.WriteAppData:
                // parse and handle app data
                await this.handleIncomingAppData(Buffer.from(data.buffer.slice(1)));

                break;
            default:
                console.warn('Unknown event type:', eventType);
                break;
        }
    }

    private async handleIncomingAppData(data: Buffer) {
        // await this.handleIncomingData_DeviceNotification(data);
    }

    private readonly APPDATA_BUFFER_SIZE = 1024;
    private readonly appdataBuffer = Buffer.alloc(this.APPDATA_BUFFER_SIZE);
    private appdataBufferOffset = 0;
    private appdataExpectedLength = 0;
    private async handleIncomingData_DeviceNotification(data: Uint8Array) {
        try {
            if (this.appdataBufferOffset === 0) {
                const payloadSize = checkIsDeviceNotification(data);
                if (!payloadSize) return;
                else {
                    const expectedLength = payloadSize + 2;
                    if (expectedLength > this.APPDATA_BUFFER_SIZE) {
                        console.warn(
                            `DeviceNotification payload too large: ${expectedLength}`,
                        );
                        return;
                    }

                    // start new buffer
                    this.appdataExpectedLength = expectedLength;
                    this.appdataBufferOffset = 0;
                    this.appdataBuffer.set(data, 0);
                }
            } else {
                this.appdataBuffer.set(data, this.appdataBufferOffset);
            }
            this.appdataBufferOffset += data.length;

            if (this.appdataBufferOffset >= this.appdataExpectedLength) {
                const payloads = parseDeviceNotificationPayloads(this.appdataBuffer);
                handleDeviceNotification(payloads);

                // reset buffer
                this.appdataBufferOffset = 0;
                this.appdataExpectedLength = 0;
            }
        } catch (error) {
            console.warn('Error parsing app data:', error);
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

    public async action_start(slot?: number) {
        await this.write(createStartUserProgramCommand(slot ?? 0), false);
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
