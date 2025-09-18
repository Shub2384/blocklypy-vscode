import { BaseMessage } from './base-message';
import { InfoResponseMessage } from './info-response-message';

export class InfoRequestMessage extends BaseMessage {
    public static readonly Id = 0x00;

    public serialize(): Uint8Array {
        return new Uint8Array([InfoRequestMessage.Id]);
    }

    public acceptsResponse(): number {
        return InfoResponseMessage.Id;
    }
}
