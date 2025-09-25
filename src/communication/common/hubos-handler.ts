import crc32 from 'crc-32';
import { logDebug } from '../../extension/debug-channel';
import { showWarning } from '../../extension/diagnostics';
import { handleDeviceNotificationAsync } from '../../logic/appdata-devicenotification-helper';
import { FILENAME_SAMPLE_COMPILED } from '../../logic/compile';
import { setState, StateProp } from '../../logic/state';
import { decodeSpikeMessage } from '../../spike/spike-messages';
import {
    BaseMessage,
    RequestMessage,
    ResponseMessage,
} from '../../spike/spike-messages/base-message';
import { ClearSlotRequestMessage } from '../../spike/spike-messages/clear-slot-request-message';
import { ClearSlotResponseMessage } from '../../spike/spike-messages/clear-slot-response-message';
import { pack, unpack } from '../../spike/spike-messages/cobs';
import { ConsoleNotificationMessage } from '../../spike/spike-messages/console-notification-message';
import { DeviceNotificationMessage } from '../../spike/spike-messages/device-notification-message';
import { DeviceNotificationRequestMessage } from '../../spike/spike-messages/device-notification-request-message';
import { InfoRequestMessage } from '../../spike/spike-messages/info-request-message';
import {
    InfoResponse,
    InfoResponseMessage,
} from '../../spike/spike-messages/info-response-message';
import { ProgramFlowNotificationMessage } from '../../spike/spike-messages/program-flow-notification-message';
import { ProgramFlowRequestMessage } from '../../spike/spike-messages/program-flow-request-message';
import { StartFileUploadRequestMessage } from '../../spike/spike-messages/start-file-upload-request-message';
import { StartFileUploadResponseMessage } from '../../spike/spike-messages/start-file-upload-response-message';
import { TransferChunkRequestMessage } from '../../spike/spike-messages/transfer-chunk-request-message';
import { TransferChunkResponseMessage } from '../../spike/spike-messages/transfer-chunk-response-message';
import { withTimeout } from '../../utils/async';

const SPIKE_RECEIVE_MESSAGE_TIMEOUT = 5000;
const CRC32_ALIGNMENT = 4;
const HUBOS_SPIKE_SLOTS = 20;

export class HubOSHandler {
    private _capabilities: InfoResponse | undefined;
    private _pendingMessagesPromises = new Map<
        number,
        [
            (result: ResponseMessage | PromiseLike<ResponseMessage>) => void,
            (e: string) => void,
        ]
    >();

    public get capabilities() {
        return this._capabilities;
    }

    public async initialize() {
        // response will be handled in handleIncomingDataAsync
        await this.sendMessage<InfoResponseMessage>(new InfoRequestMessage());
    }

    public async setDeviceNotifications(interval: number) {
        // periodic notifications
        await this.sendMessage(new DeviceNotificationRequestMessage(interval));
    }

    constructor(
        private writeHandler: (data: Uint8Array) => Promise<void>,
        private dataHandler: (text: string) => Promise<void>,
    ) {}

    public async sendMessage<TResponse extends ResponseMessage>(
        message: RequestMessage,
    ): Promise<TResponse | undefined> {
        const payload = pack(message.serialize());
        const resultTypeId = message.acceptsResponse();
        const resultPromise = new Promise<ResponseMessage>((resolve, reject) => {
            this._pendingMessagesPromises.set(resultTypeId, [resolve, reject]);
        });

        await this.writeHandler(payload);

        const response = await withTimeout<TResponse>(
            resultPromise as Promise<TResponse>,
            SPIKE_RECEIVE_MESSAGE_TIMEOUT,
        );
        return response;
    }

    public async handleIncomingDataAsync(data: Buffer) {
        const unpacked = unpack(data);

        // for (const unpacked of unpackedMulti) {
        try {
            const [_, message] = decodeSpikeMessage(unpacked);
            if (!message)
                throw new Error(`Failed to decode message: ${data.toString('hex')}`);
            // console.log(
            //     `Received message: 0x${message.Id.toString(16)}, ${
            //         message.constructor.name
            //     }`,
            // );

            await this.handleIncomingMessage(message);
        } catch (e) {
            logDebug(`Error handling message: ${String(e)}`);
        }
        // }
    }

    private async handleIncomingMessage(message: BaseMessage) {
        try {
            // logDebug(`Received message: 0x${id.toString(16)}`);
            const id = message.Id;
            const pending = this._pendingMessagesPromises.get(id);
            if (pending) {
                pending[0](message);
                pending[1] = () => {}; // prevent memory leaks
                this._pendingMessagesPromises.delete(id);
            }

            switch (id) {
                case InfoResponseMessage.Id: {
                    const infoMsg = message as InfoResponseMessage;
                    this._capabilities = infoMsg.info;
                    break;
                }
                case DeviceNotificationMessage.Id: {
                    const deviceMsg = message as DeviceNotificationMessage;
                    await handleDeviceNotificationAsync(deviceMsg.payloads);
                    break;
                }
                case ProgramFlowNotificationMessage.Id: {
                    const programFlowMsg = message as ProgramFlowNotificationMessage;
                    setState(StateProp.Running, programFlowMsg.action === 0);
                    break;
                }
                case ConsoleNotificationMessage.Id: {
                    const consoleMsg = message as ConsoleNotificationMessage;
                    console.log(' >> ', consoleMsg.text.length);
                    await this.dataHandler(consoleMsg.text);
                    break;
                }
            }
        } catch (e) {
            logDebug(`Error decoding message: ${String(e)}`);
            return;
        }
    }

    public async action_start(slot?: number) {
        await this.sendMessage(new ProgramFlowRequestMessage(true, slot)); // 1 = start
    }

    public async action_stop() {
        await this.sendMessage(new ProgramFlowRequestMessage(false)); // 0 = stop
        // hubos-usb does not send a notification when stopping the program, so we set it here
        setState(StateProp.Running, false);
    }

    public async action_upload(
        data: Uint8Array,
        slot_input?: number,
        filename?: string,
    ) {
        if (!this._capabilities) return;

        const uploadSize = data.byteLength;
        const slot = slot_input ?? 0;
        if (slot_input === undefined) {
            showWarning(
                'No slot specified, defaulting to slot 0. To specify a different slot, add a comment like "# LEGO slot: 1" at the top of your code.',
            );
        }

        // initiate upload
        const clearResponse = await this.sendMessage<ClearSlotResponseMessage>(
            new ClearSlotRequestMessage(slot),
        );
        if (!clearResponse?.success) console.warn(`Failed to clear slot ${slot}`); // not critical

        // watch out for the extension - .mpy or .py repsectively
        const uploadResponse = await this.sendMessage<StartFileUploadResponseMessage>(
            new StartFileUploadRequestMessage(
                filename ?? FILENAME_SAMPLE_COMPILED,
                slot,
                crc32WithAlignment(data),
            ),
        );
        if (!uploadResponse?.success)
            throw new Error(`Failed to initiate file upload to ${slot}`);

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
            // await delay(100); // let the hub finish processing the last chunk
        }
    }

    public async action_clear_all_slots() {
        const result: Map<boolean, number[]> = new Map([
            [true, [] as number[]],
            [false, [] as number[]],
        ]);
        for (let slot = 0; slot < HUBOS_SPIKE_SLOTS; slot++) {
            const response = await this.sendMessage<ClearSlotResponseMessage>(
                new ClearSlotRequestMessage(slot),
            );

            result.get(!!response?.success)?.push(slot);
        }

        logDebug(
            Array.from(result.entries())
                .map(
                    ([success, slots]) =>
                        `${success ? 'Cleared' : 'Not cleared'} slots: ${slots.join(
                            ', ',
                        )}`,
                )
                .join(' | '),
        );
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
