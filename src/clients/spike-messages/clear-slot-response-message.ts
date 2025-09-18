import { BaseMessageWithStatus } from './base-message';

export class ClearSlotResponseMessage extends BaseMessageWithStatus {
    public static readonly Id = 0x47;

    constructor(public status: number = 0) {
        super();
    }

    public serialize(): Uint8Array {
        return new Uint8Array([ClearSlotResponseMessage.Id, this.status]);
    }

    public static fromBytes(data: Uint8Array) {
        if (data[0] !== ClearSlotResponseMessage.Id) {
            throw new Error('Invalid ClearSlotResponseMessage');
        }
        const status = data[1];
        return new ClearSlotResponseMessage(status);
    }
}
