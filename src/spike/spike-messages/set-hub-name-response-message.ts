import { ResponseMessageWithStatus } from './base-message';

export class SetHubNameResponseMessage extends ResponseMessageWithStatus {
    public static readonly Id = 0x17;

    constructor(public status: number = 0) {
        super();
    }

    public static fromBytes(data: Uint8Array): SetHubNameResponseMessage {
        const status = data[1];
        return new SetHubNameResponseMessage(status);
    }
}
