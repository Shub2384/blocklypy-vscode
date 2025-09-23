import { SerialPort } from 'serialport';
import { DeviceMetadata } from '.';
import { RequestMessage, ResponseMessage } from '../spike/spike-messages/base-message';
import { pack, unpack } from '../spike/spike-messages/cobs';
import { GetHubNameRequestMessage } from '../spike/spike-messages/get-hub-name-request-message';
import { GetHubNameResponseMessage } from '../spike/spike-messages/get-hub-name-response-message';
import { ProductGroupDeviceTypeMap } from '../spike/spike-messages/info-response-message';
import { BaseClient } from './base-client';
import { HubOSHandler } from './common/hubos-common';
import { DeviceMetadataForUSB } from './usb-layer';

export class UsbHubOsClient extends BaseClient {
    public static readonly devtype = 'hubos-usb';
    public static readonly devname = 'HubOS on USB';
    public static readonly supportsModularMpy = false;

    private _hubOSHandler: HubOSHandler | undefined;
    private _serialPort: SerialPort | undefined;

    constructor(metadata: DeviceMetadata | undefined) {
        super(metadata);
        this._hubOSHandler = new HubOSHandler(
            (data: Uint8Array) => this.write(data),
            (text) => this.handleWriteStdout(text),
        );
    }

    public get metadata(): DeviceMetadataForUSB | undefined {
        return this._metadata as DeviceMetadataForUSB;
    }

    public get description(): string | undefined {
        const capabilities = this._hubOSHandler?.capabilities;
        if (!capabilities) return UsbHubOsClient.devname;

        const hubType =
            ProductGroupDeviceTypeMap[capabilities?.productGroupDeviceType] ??
            'Unknown Hub';
        const { rpcMajor, rpcMinor, rpcBuild, fwMajor, fwMinor, fwBuild } =
            capabilities;
        return `${hubType} with ${UsbHubOsClient.devname}, firmware: ${fwMajor}.${fwMinor}.${fwBuild}, software: ${rpcMajor}.${rpcMinor}.${rpcBuild}`;
    }

    public get connected() {
        return !!this._serialPort?.isOpen;
    }

    public async write(data: Uint8Array): Promise<void> {
        //!! if (!this.connected || !this.metadata) return;

        this._serialPort?.write(data);
        return Promise.resolve();
    }

    public async disconnect(): Promise<void> {
        await this.runExitStack();
    }

    public static async connectInternal(
        metadata: DeviceMetadataForUSB,
    ): Promise<SerialPort> {
        const portinfo = metadata?.portinfo;
        if (!portinfo) throw new Error('No port info in metadata');

        const serial = new SerialPort({
            path: portinfo.path,
            baudRate: 115200,
            autoOpen: false,
        });

        const serialPromise = new Promise<SerialPort>((resolve, reject) => {
            serial.open((err) => {
                if (err) return reject(err);
                else return resolve(serial);
            });
        });

        return serialPromise;
    }

    public static async getNameFromDevice(
        metadata: DeviceMetadataForUSB,
    ): Promise<string | undefined> {
        const serial = await UsbHubOsClient.connectInternal(metadata);

        const namePromise = new Promise<string | undefined>((resolve, reject) => {
            serial.on('data', (data: Buffer) => {
                const data2 = unpack(data);
                const response = GetHubNameResponseMessage.fromBytes(data2);
                // console.log('Received line from SPIKE USB:', hex, response);
                if (resolve) resolve(response.hubName);
                else reject(new Error('No response'));
            });
        });
        const message = new GetHubNameRequestMessage();
        const payload = pack(message.serialize());
        serial.write(payload);
        const name = await namePromise;

        serial.removeAllListeners();
        await UsbHubOsClient.closeInternal(serial);

        return name;
    }

    public static closeInternal(serial: SerialPort): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            serial.close((err) => {
                if (err) return reject(err);
                else return resolve();
            });
        });
    }

    public static async refreshDeviceName(
        metadata: DeviceMetadataForUSB,
    ): Promise<void> {
        const name = await UsbHubOsClient.getNameFromDevice(metadata);
        if (name) metadata.name = name;

        // update and refresh
        // this._listeners.forEach((fn) => fn(newMetadata));
    }

    protected async connectWorker(
        onDeviceUpdated: (device: DeviceMetadata) => void,
        onDeviceRemoved: (device: DeviceMetadata, id?: string) => void,
    ) {
        await super.connectWorker(onDeviceUpdated, onDeviceRemoved);

        const device = this.metadata?.portinfo;
        if (!device) throw new Error('No portinfo in metadata');

        this._serialPort = await UsbHubOsClient.connectInternal(this.metadata);
        this._serialPort.on(
            'data',
            (data) => void this.handleIncomingDataAsync(data as Buffer),
        );
        this._exitStack.push(async () => {
            await UsbHubOsClient.closeInternal(this._serialPort!);
            this._serialPort?.removeAllListeners();
            this._hubOSHandler = undefined;
            this._serialPort = undefined;
        });

        // will be handled in handleIncomingDataAsync for capabilities
        await this._hubOSHandler?.initialize();

        // await this._hubOSHandler?.setDeviceNotifications(100);
    }

    protected async sendMessage<TResponse extends ResponseMessage>(
        message: RequestMessage,
    ): Promise<TResponse | undefined> {
        return this._hubOSHandler?.sendMessage<TResponse>(message);
    }

    protected async handleIncomingDataAsync(data: Buffer) {
        await this._hubOSHandler?.handleIncomingDataAsync(data);
    }

    public async action_start(slot?: number) {
        await this._hubOSHandler?.action_start(slot);
    }

    public async action_stop() {
        await this._hubOSHandler?.action_stop();
    }

    public async action_upload(
        _data: Uint8Array,
        _slot?: number,
        _filename?: string,
    ): Promise<void> {
        await this._hubOSHandler?.action_upload(_data, _slot, _filename);
    }

    public async action_clear_all_slots() {
        await this._hubOSHandler?.action_clear_all_slots();
    }
}
