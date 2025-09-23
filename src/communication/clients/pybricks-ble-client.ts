import noble from '@abandonware/noble';
import semver from 'semver';
import { DeviceMetadata } from '..';
import { handleDeviceNotificationAsync } from '../../logic/appdata-devicenotification-helper';
import { setState, StateProp } from '../../logic/state';
import {
    decodePnpId,
    deviceInformationServiceUUID,
    firmwareRevisionStringUUID,
    getHubTypeName,
    PnpId,
    pnpIdUUID,
    softwareRevisionStringUUID,
} from '../../pybricks/ble-device-info-service/protocol';
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
} from '../../pybricks/ble-pybricks-service/protocol';
import {
    checkIsDeviceNotification,
    parseDeviceNotificationPayloads,
} from '../../spike/utils/device-notification';
import { DeviceMetadataWithPeripheral } from '../layers/ble-layer';
import { uuid128, uuidStr } from '../utils';
import { BaseClient } from './base-client';

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

export class PybricksBleClient extends BaseClient {
    public static readonly devtype = 'pybricks-ble';
    public static readonly devname = 'Pybricks on BLE';
    public static readonly supportsModularMpy = true;

    private _rxtxCharacteristic: noble.Characteristic | undefined;
    private _capabilitiesCharacteristic: noble.Characteristic | undefined;
    private _capabilities: Capabilities | undefined;
    private _version: VersionInfo | undefined;

    public get description() {
        const hubType = this._version
            ? getHubTypeName(this._version?.pnpId)
            : 'Unknown hub';
        const firmware = this._version?.firmware ?? 'unknown';
        const software = this._version?.software ?? 'unknown';
        return `${hubType} with ${PybricksBleClient.devname}, firmware: ${firmware}, software: ${software}`;
    }

    public get capabilities() {
        return this._capabilities;
    }

    public get connected() {
        return this.metadata?.peripheral?.state === 'connected';
    }

    protected get metadata() {
        return this._metadata as DeviceMetadataWithPeripheral;
    }

    protected async disconnectWorker() {
        if (this.connected) this.metadata.peripheral?.disconnect();
        return Promise.resolve();
    }

    protected async connectWorker(
        onDeviceUpdated: (device: DeviceMetadata) => void,
        onDeviceRemoved: (device: DeviceMetadata, id?: string) => void,
    ) {
        // --- BLE specific stuff
        const metadata = this.metadata;
        const device = metadata.peripheral;
        if (!device) throw new Error('No peripheral in metadata');

        await device.connectAsync();
        this._exitStack.push(() => {
            device.removeAllListeners('disconnect');
            if (onDeviceRemoved) onDeviceRemoved(metadata);
        });

        device.on(
            'disconnect',
            () => void this.handleDisconnectAsync(this.metadata.id),
        );

        // --- Discover services and characteristics
        const discoveredServicesandCharacterisitics =
            await device.discoverSomeServicesAndCharacteristicsAsync(
                [pybricksServiceUUID, uuid128(deviceInformationServiceUUID)],
                [
                    pybricksControlEventCharacteristicUUID,
                    pybricksHubCapabilitiesCharacteristicUUID,

                    firmwareRevisionStringUUID,
                    softwareRevisionStringUUID,
                    pnpIdUUID,
                ].map((uuid16) => uuidStr(uuid16)),
            );

        // const [pybricksService, deviceInfoService] =
        //     discoveredServicesandCharacterisitics.services;
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
            (data) => void this.handleIncomingDataAsync(data).catch(console.error),
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
        const rssiUpdater = setInterval(() => device.updateRssi(), 1000);
        // Notify listeners of RSSI update
        device.on(
            'rssiUpdate',
            () => onDeviceUpdated && onDeviceUpdated(metadata as DeviceMetadata),
        );
        this._exitStack.push(() => {
            clearInterval(rssiUpdater);
            device.removeAllListeners();
        });
    }

    public async write(data: Uint8Array, withoutResponse: boolean = false) {
        await this._rxtxCharacteristic?.writeAsync(Buffer.from(data), withoutResponse);
    }

    protected async handleIncomingDataAsync(data: Buffer): Promise<void> {
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
        await this.handleIncomingDataAsync_DeviceNotification(data);
    }

    private readonly APPDATA_BUFFER_SIZE = 1024;
    private readonly appdataBuffer = Buffer.alloc(this.APPDATA_BUFFER_SIZE);
    private appdataBufferOffset = 0;
    private appdataExpectedLength = 0;
    private async handleIncomingDataAsync_DeviceNotification(data: Uint8Array) {
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
                await handleDeviceNotificationAsync(payloads);

                // reset buffer
                this.appdataBufferOffset = 0;
                this.appdataExpectedLength = 0;
            }
        } catch (error) {
            console.warn('Error parsing app data:', error);
        }
    }

    public async sendTerminalUserInputAsync(text: string) {
        if (!this.connected) throw new Error('Not connected to a device');
        if (!this._capabilities?.maxWriteSize) return;

        const maxBleWriteSize = this._capabilities.maxWriteSize;
        // assert(maxBleWriteSize >= 20, 'bad maxBleWriteSize');
        const value = text;
        const encoder = new TextEncoder();
        const data = encoder.encode(value);

        for (let i = 0; i < data.length; i += maxBleWriteSize) {
            await this.write(createWriteStdinCommand(data.buffer), false);
        }
    }

    public async action_start(slot?: number) {
        await this.write(createStartUserProgramCommand(slot ?? 0), false);
    }

    public async action_stop() {
        await this.write(createStopUserProgramCommand(), false);
    }

    public async action_upload(data: Uint8Array, _slot?: number, _filename?: string) {
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
                const chunkBuffer = chunk.buffer;
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
