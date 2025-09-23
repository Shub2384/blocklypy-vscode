import { RequestMessage } from './base-message';
import { GetHubNameResponseMessage } from './get-hub-name-response-message';

export class GetHubNameRequestMessage extends RequestMessage {
    public static readonly Id = 0x18;

    constructor() {
        super();
    }

    public serialize(): Uint8Array {
        // Only the message type (0x18) is needed
        return new Uint8Array([GetHubNameRequestMessage.Id]);
    }

    public acceptsResponse(): number {
        return GetHubNameResponseMessage.Id;
    }
}
