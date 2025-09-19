import { ResponseMessageWithStatus } from './base-message';

export class MoveSlotResponseMessage extends ResponseMessageWithStatus {
    public static readonly Id = 0x49;

    constructor(public status: number = 0) {
        super();
    }

    public static fromBytes(data: Uint8Array): MoveSlotResponseMessage {
        const status = data[1];
        return new MoveSlotResponseMessage(status);
    }
}
