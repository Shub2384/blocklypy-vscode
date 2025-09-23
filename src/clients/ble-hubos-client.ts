import noble from '@abandonware/noble';
import { DeviceMetadata } from '.';
import {
    SPIKE_RX_CHAR_UUID,
    SPIKE_SERVICE_UUID,
    SPIKE_TX_CHAR_UUID,
} from '../spike/protocol';
import { RequestMessage, ResponseMessage } from '../spike/spike-messages/base-message';
import { ProductGroupDeviceTypeMap } from '../spike/spike-messages/info-response-message';
import { BleBaseClient } from './ble-base-client';
import { HubOSHandler } from './common/hubos-common';

export class BleHubOsClient extends BleBaseClient {
    public static readonly devtype = 'hubos-ble';
    public static readonly devname = 'HubOS on BLE';
    public static readonly supportsModularMpy = false;

    private _hubOSHandler: HubOSHandler | undefined;
    private _rxCharacteristic: noble.Characteristic | undefined;
    private _txCharacteristic: noble.Characteristic | undefined;
    private _pendingMessagesPromises = new Map<
        number,
        [
            (result: ResponseMessage | PromiseLike<ResponseMessage>) => void,
            (e: string) => void,
        ]
    >();

    public get description(): string | undefined {
        const capabilities = this._hubOSHandler?.capabilities;
        if (!capabilities) return BleHubOsClient.devname;

        const hubType =
            ProductGroupDeviceTypeMap[capabilities?.productGroupDeviceType] ??
            'Unknown Hub';
        const { rpcMajor, rpcMinor, rpcBuild, fwMajor, fwMinor, fwBuild } =
            capabilities;
        return `${hubType} with ${BleHubOsClient.devname}, firmware: ${fwMajor}.${fwMinor}.${fwBuild}, software: ${rpcMajor}.${rpcMinor}.${rpcBuild}`;
    }

    constructor(metadata: DeviceMetadata | undefined) {
        super(metadata);
        this._hubOSHandler = new HubOSHandler(
            (data: Uint8Array) => this.write(data, true),
            (text) => this.handleWriteStdout(text),
        );
    }

    protected async connectWorker(
        onDeviceUpdated: (device: DeviceMetadata) => void,
        onDeviceRemoved: (device: DeviceMetadata, name?: string) => void,
    ) {
        await super.connectWorker(onDeviceUpdated, onDeviceRemoved);

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

    public async write(data: Uint8Array, withoutResponse: boolean = false) {
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

    protected async sendMessage<TResponse extends ResponseMessage>(
        message: RequestMessage,
    ): Promise<TResponse | undefined> {
        return this._hubOSHandler?.sendMessage<TResponse>(message);
    }

    protected async handleIncomingDataAsync(data: Buffer) {
        await this._hubOSHandler?.handleIncomingDataAsync(data);
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

    public async action_start(slot?: number) {
        await this._hubOSHandler?.action_start(slot);
    }

    public async action_stop() {
        await this._hubOSHandler?.action_stop();
    }

    public async action_upload(
        data: Uint8Array,
        slot_input?: number,
        filename?: string,
    ) {
        await this._hubOSHandler?.action_upload(data, slot_input, filename);
    }

    public async action_clear_all_slots() {
        await this._hubOSHandler?.action_clear_all_slots();
    }
}
