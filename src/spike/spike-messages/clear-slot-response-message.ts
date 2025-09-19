import { ResponseMessageWithStatus } from './base-message';

export class ClearSlotResponseMessage extends ResponseMessageWithStatus {
    public static readonly Id = 0x47;

    constructor(public status: number = 0) {
        super();
    }

    static fromBytes(data: Uint8Array): ClearSlotResponseMessage {
        const status = data[1];
        return new ClearSlotResponseMessage(status);
    }
}
