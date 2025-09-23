import { ResponseMessage } from './base-message';

export class GetHubNameResponseMessage extends ResponseMessage {
    public static readonly Id = 0x19;

    constructor(public hubName: string) {
        super();
    }

    public static fromBytes(data: Uint8Array): GetHubNameResponseMessage {
        if (data[0] !== GetHubNameResponseMessage.Id) {
            throw new Error('Invalid message type for GetHubNameResponseMessage.');
        }
        // Decode the hub name (30 bytes, null-terminated)
        const hubName = new TextDecoder().decode(data.slice(1)).replace(/\0/g, '');
        return new GetHubNameResponseMessage(hubName);
    }
}
