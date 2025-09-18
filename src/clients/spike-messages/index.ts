import { BaseMessage } from './base-message';
import { ClearSlotRequestMessage } from './clear-slot-request-message';
import { ClearSlotResponseMessage } from './clear-slot-response-message';
import { ConsoleNotificationMessage } from './console-notification-message';
import { DeviceNotificationMessage } from './device-notification-message';
import { DeviceNotificationRequestMessage } from './device-notification-request-message';
import { DeviceNotificationResponseMessage } from './device-notification-response-message';
import { DeviceUuidRequestMessage } from './device-uuid-request-message';
import { DeviceUuidResponseMessage } from './device-uuid-response-message';
import { InfoRequestMessage } from './info-request-message';
import { InfoResponseMessage } from './info-response-message';
import { ProgramFlowNotificationMessage } from './program-flow-notification-message';
import { ProgramFlowRequestMessage } from './program-flow-request-message';
import { ProgramFlowResponseMessage } from './program-flow-response-message';
import { StartFileUploadRequestMessage } from './start-file-upload-request-message';
import { StartFileUploadResponseMessage } from './start-file-upload-response-message';
import { TransferChunkRequestMessage } from './transfer-chunk-request-message';
import { TransferChunkResponseMessage } from './transfer-chunk-response-message';
import { TunnelMessage } from './tunnel-message';

type MessageConstructor = {
    Id: number;
    new (...args: any[]): BaseMessage;
    fromBytes(data: Uint8Array): BaseMessage;
};

export const SpikeMessageMap: { [id: number]: MessageConstructor } = {
    [ClearSlotRequestMessage.Id]: ClearSlotRequestMessage,
    [ClearSlotResponseMessage.Id]: ClearSlotResponseMessage,
    [ConsoleNotificationMessage.Id]: ConsoleNotificationMessage,
    [DeviceNotificationMessage.Id]: DeviceNotificationMessage,
    [DeviceNotificationRequestMessage.Id]: DeviceNotificationRequestMessage,
    [DeviceNotificationResponseMessage.Id]: DeviceNotificationResponseMessage,
    [DeviceUuidRequestMessage.Id]: DeviceUuidRequestMessage,
    [DeviceUuidResponseMessage.Id]: DeviceUuidResponseMessage,
    [InfoRequestMessage.Id]: InfoRequestMessage,
    [InfoResponseMessage.Id]: InfoResponseMessage,
    [ProgramFlowNotificationMessage.Id]: ProgramFlowNotificationMessage,
    [ProgramFlowRequestMessage.Id]: ProgramFlowRequestMessage,
    [ProgramFlowResponseMessage.Id]: ProgramFlowResponseMessage,
    [StartFileUploadRequestMessage.Id]: StartFileUploadRequestMessage,
    [StartFileUploadResponseMessage.Id]: StartFileUploadResponseMessage,
    [TransferChunkRequestMessage.Id]: TransferChunkRequestMessage,
    [TransferChunkResponseMessage.Id]: TransferChunkResponseMessage,
    [TunnelMessage.Id]: TunnelMessage,
};

export function decodeSpikeMessage(
    data: Uint8Array,
): [id: number, message: BaseMessage] {
    const id = data[0];
    const MessageClass = SpikeMessageMap[id];
    if (!MessageClass) {
        throw new Error(`Unknown message ID: ${id}`);
    }
    const message = MessageClass.fromBytes(data);
    return [id, message];
}
