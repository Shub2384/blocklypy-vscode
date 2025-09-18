import { BaseMessage } from './base-message';
import { DeviceUuidResponseMessage } from './device-uuid-response-message';

export class DeviceUuidRequestMessage extends BaseMessage {
    public static readonly Id = 0x1a;

    public serialize(): Uint8Array {
        return new Uint8Array([DeviceUuidRequestMessage.Id]);
    }

    public acceptsResponse(): number {
        return DeviceUuidResponseMessage.Id;
    }
}
