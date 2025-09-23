import { SerialPort } from 'serialport';
import { DeviceMetadata } from '..';
import { pack, unpack } from '../../spike/spike-messages/cobs';
import { GetHubNameRequestMessage } from '../../spike/spike-messages/get-hub-name-request-message';
import { GetHubNameResponseMessage } from '../../spike/spike-messages/get-hub-name-response-message';
import { ProductGroupDeviceTypeMap } from '../../spike/spike-messages/info-response-message';
import { DeviceMetadataForUSB } from '../layers/usb-layer';
import { HubOSBaseClient } from './hubos-base-client';

export class HubOSUsbClient extends HubOSBaseClient {
    public static readonly devtype = 'hubos-usb';
    public static readonly devname = 'HubOS on USB';
    public static readonly supportsModularMpy = false;

    private _serialPort: SerialPort | undefined;

    public get metadata(): DeviceMetadataForUSB | undefined {
        return this._metadata as DeviceMetadataForUSB;
    }

    public get description(): string | undefined {
        const capabilities = this._hubOSHandler?.capabilities;
        if (!capabilities) return HubOSUsbClient.devname;

        const hubType =
            ProductGroupDeviceTypeMap[capabilities?.productGroupDeviceType] ??
            'Unknown Hub';
        const { rpcMajor, rpcMinor, rpcBuild, fwMajor, fwMinor, fwBuild } =
            capabilities;
        return `${hubType} with ${HubOSUsbClient.devname}, firmware: ${fwMajor}.${fwMinor}.${fwBuild}, software: ${rpcMajor}.${rpcMinor}.${rpcBuild}`;
    }

    public get connected() {
        return !!this._serialPort?.isOpen;
    }

    public async write(data: Uint8Array): Promise<void> {
        //!! if (!this.connected || !this.metadata) return;

        this._serialPort?.write(data);
        return Promise.resolve();
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
        const serial = await HubOSUsbClient.connectInternal(metadata);

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
        await HubOSUsbClient.closeInternal(serial);

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
        const name = await HubOSUsbClient.getNameFromDevice(metadata);
        if (name) metadata.name = name;

        // update and refresh
        // this._listeners.forEach((fn) => fn(newMetadata));
    }

    protected async connectWorker(
        _onDeviceUpdated: (device: DeviceMetadata) => void,
        onDeviceRemoved: (device: DeviceMetadata) => void,
    ) {
        const metadata = this.metadata;
        const device = metadata?.portinfo;
        if (!device) throw new Error('No portinfo in metadata');

        this._serialPort = await HubOSUsbClient.connectInternal(metadata);
        this._exitStack.push(() => {
            if (onDeviceRemoved) onDeviceRemoved(metadata);
        });

        this._serialPort.on(
            'data',
            (data) => void this.handleIncomingDataAsync(data as Buffer),
        );
        this._exitStack.push(async () => {
            await HubOSUsbClient.closeInternal(this._serialPort!);
            this._serialPort?.removeAllListeners();
            this._hubOSHandler = undefined;
            this._serialPort = undefined;
        });

        // will be handled in handleIncomingDataAsync for capabilities
        await this._hubOSHandler?.initialize();

        // await this._hubOSHandler?.setDeviceNotifications(100);
    }
}
