import { Characteristic } from '@stoprocent/noble';
import { DeviceMetadata } from '..';
import {
    SPIKE_RX_CHAR_UUID,
    SPIKE_SERVICE_UUID,
    SPIKE_TX_CHAR_UUID,
} from '../../spike/protocol';
import { ResponseMessage } from '../../spike/spike-messages/base-message';
import { ProductGroupDeviceTypeMap } from '../../spike/spike-messages/info-response-message';
import { HubOSHandler } from '../common/hubos-handler';
import { DeviceMetadataWithPeripheral } from '../layers/ble-layer';
import { HubOSBaseClient } from './hubos-base-client';

export class HubOSBleClient extends HubOSBaseClient {
    public static readonly devtype = 'hubos-ble';
    public static readonly devname = 'HubOS on BLE';
    public static readonly supportsModularMpy = false;

    private _rxCharacteristic: Characteristic | undefined;
    private _txCharacteristic: Characteristic | undefined;
    private _pendingMessagesPromises = new Map<
        number,
        [
            (result: ResponseMessage | PromiseLike<ResponseMessage>) => void,
            (e: string) => void,
        ]
    >();

    public get description(): string | undefined {
        const capabilities = this._hubOSHandler?.capabilities;
        if (!capabilities) return HubOSBleClient.devname;

        const hubType =
            ProductGroupDeviceTypeMap[capabilities?.productGroupDeviceType] ??
            'Unknown Hub';
        const { rpcMajor, rpcMinor, rpcBuild, fwMajor, fwMinor, fwBuild } =
            capabilities;
        return `${hubType} with ${HubOSBleClient.devname}, firmware: ${fwMajor}.${fwMinor}.${fwBuild}, software: ${rpcMajor}.${rpcMinor}.${rpcBuild}`;
    }

    public get connected() {
        return this.metadata?.peripheral?.state === 'connected';
    }

    protected get metadata() {
        return this._metadata as DeviceMetadataWithPeripheral;
    }

    constructor(metadata: DeviceMetadata | undefined) {
        super(metadata);
        this._hubOSHandler = new HubOSHandler(
            (data: Uint8Array) => this.write(data, true),
            (text) => this.handleWriteStdout(text),
        );
    }

    protected async disconnectWorker() {
        if (this.connected) this.metadata.peripheral?.disconnect();
        return Promise.resolve();
    }

    protected async connectWorker(
        onDeviceUpdated: (device: DeviceMetadata) => void,
        onDeviceRemoved: (device: DeviceMetadata) => void,
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
        const peripheral = this.metadata.peripheral;
        if (!peripheral) throw new Error('No peripheral in metadata');

        this._exitStack.push(async () => {
            this._rxCharacteristic?.removeAllListeners('data');
            await this._rxCharacteristic?.unsubscribeAsync();
            this._rxCharacteristic = undefined;
        });

        const chars = await peripheral.discoverSomeServicesAndCharacteristicsAsync(
            [SPIKE_SERVICE_UUID],
            [SPIKE_RX_CHAR_UUID, SPIKE_TX_CHAR_UUID],
        );
        [this._rxCharacteristic, this._txCharacteristic] = chars?.characteristics;
        this._txCharacteristic.on('data', (data) => {
            // intentionally not awaited
            this.handleIncomingDataAsync(data).catch(console.error);
        });
        await this._txCharacteristic.subscribeAsync();

        await this._hubOSHandler?.initialize();

        // Repeatedly update RSSI and notify listeners of RSSI update
        const rssiUpdater = setInterval(() => peripheral.updateRssi(), 1000);
        peripheral.on(
            'rssiUpdate',
            () => onDeviceUpdated && onDeviceUpdated(this.metadata),
        );
        this._exitStack.push(() => {
            clearInterval(rssiUpdater);
            peripheral.removeAllListeners();
        });
    }

    public async write(data: Uint8Array, withoutResponse: boolean = true) {
        const packetSize =
            this._hubOSHandler?.capabilities?.maxPacketSize ?? data.length;
        for (let loop = 0; loop < data.length; loop += packetSize) {
            const chunk = data.slice(loop, loop + packetSize);
            await this._rxCharacteristic?.writeAsync(
                Buffer.from(chunk),
                withoutResponse,
            );
        }
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public async sendTerminalUserInputAsync(_text: string) {
        if (!this.connected) throw new Error('Not connected to a device');

        // In SPIKE Prime, TunnelMessage allows sending arbitrary data between the robot's program and a custom application
        // (e.g., web or Python environment). This enables advanced interaction, such as exchanging sensor readings or motor
        // commands, and offers more flexibility than the built-in broadcast message blocks.

        // const message = new TunnelMessage(Buffer.from(text, 'utf-8'));
        // const response = await this.sendMessage(message);
        // console.log('TunnelMessage response:', response);
    }
}
