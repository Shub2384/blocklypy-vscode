import { SerialPort } from 'serialport';
import { DeviceMetadata } from '..';
import { maybe } from '../../pybricks/utils';
import { pack, unpack } from '../../spike/spike-messages/cobs';
import { GetHubNameRequestMessage } from '../../spike/spike-messages/get-hub-name-request-message';
import { GetHubNameResponseMessage } from '../../spike/spike-messages/get-hub-name-response-message';
import { DeviceMetadataForUSB, USBLayer } from '../layers/usb-layer';
import { HubOSBaseClient } from './hubos-base-client';

const GET_SERIAL_NAME_TIMEOUT = 3000;

export class HubOSUsbClient extends HubOSBaseClient {
    public static readonly devtype = 'hubos-usb';
    public static readonly devname = 'HubOS on USB';
    public static readonly supportsModularMpy = false;

    private _serialPort: SerialPort | undefined;

    public get metadata(): DeviceMetadataForUSB | undefined {
        return this._metadata as DeviceMetadataForUSB;
    }

    public get connected() {
        return !!this._serialPort?.isOpen;
    }

    public get location(): string | undefined {
        return this._serialPort?.path; // use path as id for USB
    }

    public set serialPort(port: SerialPort | undefined) {
        this._serialPort = port;
    }

    public async write(data: Uint8Array): Promise<void> {
        if (!this.connected || !this.metadata) return; // before connecting use serial.write directly for getName

        this._serialPort?.write(data);
        return Promise.resolve();
    }

    public static async getNameFromDevice(
        serial: SerialPort,
    ): Promise<string | undefined> {
        try {
            const namePromiseWithWrite = new Promise<string | undefined>(
                (resolve, reject) => {
                    let timer: NodeJS.Timeout | undefined;
                    const dataHandler = (data: Buffer) => {
                        serial.removeListener('data', dataHandler);
                        if (timer) {
                            clearTimeout(timer);
                            timer = undefined;
                        }

                        let hubName: string | undefined;
                        try {
                            const data2 = unpack(data);
                            hubName =
                                GetHubNameResponseMessage.fromBytes(data2).hubName;
                        } catch {
                            reject(new Error('Failed to parse response'));
                            return;
                        }

                        if (hubName) resolve(hubName);
                        else reject(new Error('No response'));
                    };
                    serial.on('data', dataHandler);

                    const message = new GetHubNameRequestMessage();
                    const payload = pack(message.serialize());
                    serial.write(payload);
                    timer = setTimeout(() => {
                        serial.removeListener('data', dataHandler);
                        reject(new Error('Timeout waiting for response'));
                    }, GET_SERIAL_NAME_TIMEOUT);
                },
            );
            const [name, _] = await maybe(namePromiseWithWrite);
            return name;
        } catch (e) {
            console.error('Error getting name from USB device:', e);
        }
    }

    public static async refreshDeviceName(
        serial: SerialPort,
        metadata: DeviceMetadataForUSB,
    ): Promise<void> {
        const name = await HubOSUsbClient.getNameFromDevice(serial);
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

        this._serialPort = await (this.parent as USBLayer).openPort(metadata);
        if (!this._serialPort.isOpen) throw new Error('Failed to open serial port');

        this._exitStack.push(() => {
            if (onDeviceRemoved) onDeviceRemoved(metadata);
        });

        const handleData = (data: Buffer) => void this.handleIncomingDataAsync(data);
        const handleClose = () => void this.handleDisconnectAsync(metadata.id);
        this._serialPort.on('data', handleData);
        this._serialPort.on('close', handleClose);

        this._exitStack.push(async () => {
            await (this.parent as USBLayer).closePort(this._serialPort!);
            this._serialPort?.removeListener('data', handleData);
            this._serialPort?.removeListener('close', handleClose);
            this._hubOSHandler = undefined;
            this._serialPort = undefined;
        });

        // will be handled in handleIncomingDataAsync for capabilities
        await this._hubOSHandler?.initialize();

        // await this._hubOSHandler?.setDeviceNotifications(100);
    }

    protected async disconnectWorker() {
        await super.disconnectWorker();

        this._serialPort?.removeAllListeners();
        if (this._serialPort)
            await (this.parent as USBLayer).closePort(this._serialPort);
        this._serialPort = undefined;
    }
}
