import { BaseMessage } from './base-message';
import { BeginFirmwareUpdateRequestMessage } from './begin-firmware-update-request-message';
import { BeginFirmwareUpdateResponseMessage } from './begin-firmware-update-response-message';
import { ClearSlotRequestMessage } from './clear-slot-request-message';
import { ClearSlotResponseMessage } from './clear-slot-response-message';
import { ConsoleNotificationMessage } from './console-notification-message';
import { DeletePathRequestMessage } from './delete-path-request-message';
import { DeletePathResponseMessage } from './delete-path-response-message';
import { DeviceNotificationMessage } from './device-notification-message';
import { DeviceNotificationRequestMessage } from './device-notification-request-message';
import { DeviceNotificationResponseMessage } from './device-notification-response-message';
import { DeviceUuidRequestMessage } from './device-uuid-request-message';
import { DeviceUuidResponseMessage } from './device-uuid-response-message';
import { InfoRequestMessage } from './info-request-message';
import { InfoResponseMessage } from './info-response-message';
import { ListPathRequestMessage } from './list-path-request-message';
import { ListPathResponseMessage } from './list-path-response-message';
import { MoveSlotRequestMessage } from './move-slot-request-message';
import { MoveSlotResponseMessage } from './move-slot-response-message';
import { ProgramFlowNotificationMessage } from './program-flow-notification-message';
import { ProgramFlowRequestMessage } from './program-flow-request-message';
import { ProgramFlowResponseMessage } from './program-flow-response-message';
import { StartFileDownloadRequestMessage } from './start-file-download-request-message';
import { StartFileDownloadResponseMessage } from './start-file-download-response-message';
import { StartFileUploadRequestMessage } from './start-file-upload-request-message';
import { StartFileUploadResponseMessage } from './start-file-upload-response-message';
import { StartFirmwareUploadRequestMessage } from './start-firmware-upload-request-message';
import { StartFirmwareUploadResponseMessage } from './start-firmware-upload-response-message';
import { TransferChunkRequestMessage } from './transfer-chunk-request-message';
import { TransferChunkResponseMessage } from './transfer-chunk-response-message';
import { TunnelMessage } from './tunnel-message';

type MessageConstructor = {
    Id: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new (...args: any[]): BaseMessage;
    fromBytes(data: Uint8Array): BaseMessage;
};

export const SpikeMessageMap: { [id: number]: MessageConstructor } = {
    [InfoRequestMessage.Id]: InfoRequestMessage, // 0x00
    [InfoResponseMessage.Id]: InfoResponseMessage, // 0x01
    [StartFirmwareUploadRequestMessage.Id]: StartFirmwareUploadRequestMessage, // 0x0a
    [StartFirmwareUploadResponseMessage.Id]: StartFirmwareUploadResponseMessage, // 0x0b
    [StartFileUploadRequestMessage.Id]: StartFileUploadRequestMessage, // 0x0c
    [StartFileUploadResponseMessage.Id]: StartFileUploadResponseMessage, // 0x0d
    [StartFileDownloadRequestMessage.Id]: StartFileDownloadRequestMessage, // 0x0e
    [StartFileDownloadResponseMessage.Id]: StartFileDownloadResponseMessage, // 0x0f
    [TransferChunkRequestMessage.Id]: TransferChunkRequestMessage, // 0x10
    [TransferChunkResponseMessage.Id]: TransferChunkResponseMessage, // 0x11
    [BeginFirmwareUpdateRequestMessage.Id]: BeginFirmwareUpdateRequestMessage, // 0x14
    [BeginFirmwareUpdateResponseMessage.Id]: BeginFirmwareUpdateResponseMessage, // 0x15
    // 0x16	SetHubNameRequest
    // 0x17	SetHubNameResponse
    // 0x18	GetHubNameRequest
    // 0x19	GetHubNameResponse
    [DeviceUuidRequestMessage.Id]: DeviceUuidRequestMessage, // 0x1a
    [DeviceUuidResponseMessage.Id]: DeviceUuidResponseMessage, // 0x1b
    [ProgramFlowRequestMessage.Id]: ProgramFlowRequestMessage, // 0x1e
    [ProgramFlowResponseMessage.Id]: ProgramFlowResponseMessage, // 0x1f
    [ProgramFlowNotificationMessage.Id]: ProgramFlowNotificationMessage, // 0x20
    [ConsoleNotificationMessage.Id]: ConsoleNotificationMessage, // 0x21
    [DeviceNotificationRequestMessage.Id]: DeviceNotificationRequestMessage, // 0x28
    [DeviceNotificationResponseMessage.Id]: DeviceNotificationResponseMessage, // 0x29
    [DeviceNotificationMessage.Id]: DeviceNotificationMessage, // 0x3c
    [TunnelMessage.Id]: TunnelMessage, // 0x32
    [ClearSlotRequestMessage.Id]: ClearSlotRequestMessage, // 0x46
    [ClearSlotResponseMessage.Id]: ClearSlotResponseMessage, // 0x47
    [MoveSlotRequestMessage.Id]: MoveSlotRequestMessage, // 0x48
    [MoveSlotResponseMessage.Id]: MoveSlotResponseMessage, // 0x49
    [ListPathRequestMessage.Id]: ListPathRequestMessage, // 0x4a
    [ListPathResponseMessage.Id]: ListPathResponseMessage, // 0x4b
    [DeletePathRequestMessage.Id]: DeletePathRequestMessage, // 0x4c
    [DeletePathResponseMessage.Id]: DeletePathResponseMessage, // 0x4d
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
