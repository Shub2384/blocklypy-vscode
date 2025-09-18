import noble from '@abandonware/noble';
import crc32 from 'crc-32';
import { DeviceMetadata } from '.';
import { logDebug } from '../extension/debug-channel';
import { clearPythonErrors } from '../extension/diagnostics';
import { FILENAME_SAMPLE_COMPILED } from '../logic/compile';
import { setState, StateProp } from '../logic/state';
import {
    SPIKE_RX_CHAR_UUID,
    SPIKE_SERVICE_UUID,
    SPIKE_TX_CHAR_UUID,
} from '../spike/protocol';
import { withTimeout } from '../utils/async';
import { BaseClient } from './base-client';
import { pack, unpack } from './cobs';
import { decodeSpikeMessage } from './spike-messages';
import { BaseMessage } from './spike-messages/base-message';
import { ConsoleNotificationMessage } from './spike-messages/console-notification-message';
import { DeviceNotificationMessage } from './spike-messages/device-notification-message';
import { InfoRequestMessage } from './spike-messages/info-request-message';
import {
    InfoResponse,
    InfoResponseMessage,
} from './spike-messages/info-response-message';
import { ProgramFlowNotificationMessage } from './spike-messages/program-flow-notification-message';
import { ProgramFlowRequestMessage } from './spike-messages/program-flow-request-message';
import { StartFileUploadRequestMessage } from './spike-messages/start-file-upload-request-message';
import { StartFileUploadResponseMessage } from './spike-messages/start-file-upload-response-message';
import { TransferChunkRequestMessage } from './spike-messages/transfer-chunk-request-message';
import { TransferChunkResponseMessage } from './spike-messages/transfer-chunk-response-message';
import { TunnelMessage } from './spike-messages/tunnel-message';

const SPIKE_RECEIVE_MESSAGE_TIMEOUT = 5000; // ms
const CRC32_ALIGNMENT = 4;

export class BleSpikeClient extends BaseClient {
    public static readonly devtype = 'ble-spike';
    public static readonly devname = 'SPIKE Prime / Robot Inventor';
    public static readonly supportsModularMpy = false;

    private _rxCharacteristic: noble.Characteristic | undefined;
    private _txCharacteristic: noble.Characteristic | undefined;
    private _pendingMessagesPromises = new Map<
        number,
        [(result: BaseMessage | PromiseLike<BaseMessage>) => void, (e: string) => void]
    >();
    private _capabilities: InfoResponse | undefined;

    constructor() {
        super();
    }

    public get name() {
        return this._device?.peripheral?.advertisement.localName;
    }

    public get connected() {
        return this._device?.peripheral.state === 'connected';
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
            this._rxCharacteristic?.removeAllListeners('data');
            await this._rxCharacteristic?.unsubscribeAsync();
            this._rxCharacteristic = undefined;
        });

        const chars = await peripheral.discoverSomeServicesAndCharacteristicsAsync(
            [SPIKE_SERVICE_UUID],
            [SPIKE_RX_CHAR_UUID, SPIKE_TX_CHAR_UUID],
        );
        [this._rxCharacteristic, this._txCharacteristic] = chars?.characteristics;
        this._txCharacteristic.on('data', (data) => this.handleIncomingData(data));
        await this._txCharacteristic.subscribeAsync();

        const infoResponse = await this.sendMessage<InfoResponseMessage>(
            new InfoRequestMessage(),
        );
        this._capabilities = infoResponse?.info;
        // logDebug(`infoResponse ${JSON.stringify(infoResponse?.info)}`); //!!

        // {
        //     const response = await this.sendMessage(
        //         new DeviceNotificationRequestMessage(100),
        //     );
        //     if (response) parsePlotCommand(`plot: start yaw`); //!!
        // }

        // Repeatedly update RSSI and notify listeners of RSSI update
        // const rssiUpdater = setInterval(() => peripheral.updateRssi(), 1000);
        // peripheral.on('rssiUpdate', () => onDeviceUpdated && onDeviceUpdated(device));
        // this._exitStack.push(async () => {
        //     clearInterval(rssiUpdater);
        //     peripheral.removeAllListeners();
        // });
    }

    public async write(data: Uint8Array, withoutResponse: boolean = false) {
        await this._rxCharacteristic?.writeAsync(Buffer.from(data), withoutResponse);
    }

    protected async sendMessage<TResponse extends BaseMessage = BaseMessage>(
        message: BaseMessage,
    ): Promise<TResponse | undefined> {
        const payload = pack(message.serialize());
        const resultTypeId = message.acceptsResponse();
        const resultPromise = new Promise<BaseMessage>((resolve, reject) => {
            this._pendingMessagesPromises.set(resultTypeId, [resolve, reject]);
        });

        // Split data in chunks based on maxPacketSize. If none, assume it is small enough to send in one go.
        const packetSize = this._capabilities?.maxPacketSize ?? payload.length;
        for (let loop = 0; loop < payload.length; loop += packetSize) {
            await this.write(payload.slice(loop, loop + packetSize), true);
        }

        // return (await Promise.race([
        //     resultPromise as Promise<TResponse>,
        //     new Promise<undefined>((resolve) =>
        //         setTimeout(() => resolve(undefined), SPIKE_RECEIVE_MESSAGE_TIMEOUT),
        //     ),
        // ])) as Promise<TResponse | undefined>;

        // return await setTimeoutAsync<TResponse>(
        //     resultPromise as Promise<TResponse>,
        //     SPIKE_RECEIVE_MESSAGE_TIMEOUT,
        // );

        return await withTimeout<TResponse>(
            resultPromise as Promise<TResponse>,
            SPIKE_RECEIVE_MESSAGE_TIMEOUT,
        );
    }

    protected handleIncomingData(data: Buffer) {
        const unpacked = unpack(data);
        try {
            const [id, response] = decodeSpikeMessage(unpacked);
            // logDebug(`Received message: 0x${id.toString(16)}`);
            if (!response)
                throw new Error(`Failed to decode message: ${data.toString('hex')}`);

            const pending = this._pendingMessagesPromises.get(id);
            if (pending) {
                pending[0](response);
                this._pendingMessagesPromises.delete(id);
            } else {
                switch (id) {
                    case DeviceNotificationMessage.Id: {
                        const deviceMsg =
                            response as unknown as DeviceNotificationMessage;
                        for (const payload of deviceMsg.payloads) {
                            logDebug(`DeviceNotification: ${JSON.stringify(payload)}`);
                            //!!
                            // if (payload.type === 'imu') {
                            //     const yaw = payload.yaw;
                            //     parsePlotCommand(`plot: ${yaw}`);
                            // }
                        }
                        break;
                    }
                    case ProgramFlowNotificationMessage.Id: {
                        const programFlowMsg =
                            response as unknown as ProgramFlowNotificationMessage;
                        setState(StateProp.Running, programFlowMsg.action === 0);
                        break;
                    }
                    case ConsoleNotificationMessage.Id: {
                        const consoleMsg =
                            response as unknown as ConsoleNotificationMessage;
                        this.handleWriteStdout(consoleMsg.text);
                        break;
                    }
                }
            }
        } catch (e) {
            logDebug(`Error decoding message:  ${e}`);
            return;
        }
    }

    public async sendTerminalUserInput(text: string) {
        if (!this.connected) throw new Error('Not connected to a device');

        // In SPIKE Prime, TunnelMessage allows sending arbitrary data between the robot's program and a custom application
        // (e.g., web or Python environment). This enables advanced interaction, such as exchanging sensor readings or motor
        // commands, and offers more flexibility than the built-in broadcast message blocks.

        const message = new TunnelMessage(Buffer.from(text, 'utf-8'));
        const response = await this.sendMessage(message);
        console.log('TunnelMessage response:', response);
    }

    public async action_start(slot?: number) {
        await this.sendMessage(new ProgramFlowRequestMessage(true, slot)); // 1 = start
    }

    public async action_stop() {
        await this.sendMessage(new ProgramFlowRequestMessage(false)); // 0 = stop
    }

    public async action_upload(data: Uint8Array, slot?: number, filename?: string) {
        {
            if (!this._capabilities) return;

            const uploadSize = data.byteLength;

            // watch out for the extension - .mpy or .py repsectively
            const uploadResponse =
                await this.sendMessage<StartFileUploadResponseMessage>(
                    new StartFileUploadRequestMessage(
                        filename ?? FILENAME_SAMPLE_COMPILED,
                        slot ?? 0,
                        crc32WithAlignment(data),
                    ),
                );
            if (!uploadResponse?.success)
                throw new Error('Failed to initiate file upload');

            const blockSize: number = this._capabilities.maxChunkSize;
            // const increment = (1 / Math.ceil(uploadSize / blockSize)) * 100;
            let runningCrc = 0;

            for (let loop = 0; loop < uploadSize; loop += blockSize) {
                const chunk = data.slice(loop, loop + blockSize);
                runningCrc = crc32WithAlignment(chunk, runningCrc);

                const resp = await this.sendMessage<TransferChunkResponseMessage>(
                    new TransferChunkRequestMessage(runningCrc, new Uint8Array(chunk)),
                );
                if (!resp?.success) console.warn('Failed to send chunk'); // TODO: retry?
                //progress?.report({ increment });
            }
        }
    }
}

export function crc32WithAlignment(data: Uint8Array, seed = 0): number {
    const remainder = data.byteLength % CRC32_ALIGNMENT;
    const alignedData = new Uint8Array(
        data.byteLength + ((CRC32_ALIGNMENT - remainder) % CRC32_ALIGNMENT),
    );
    alignedData.set(Buffer.from(data));

    return crc32.buf(alignedData, seed);
}

/*
This project includes code from "LEGO SPIKE Prime / MINDSTORMS Robot Inventor VS Code Extension" by Peter Staev,
licensed under the Apache License, Version 2.0.
See the LICENSE.txt file for details.
*/
