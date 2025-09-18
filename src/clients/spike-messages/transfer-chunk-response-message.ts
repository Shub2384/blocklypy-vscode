import { BaseMessageWithStatus } from './base-message';

export class TransferChunkResponseMessage extends BaseMessageWithStatus {
    public static readonly Id = 0x11;

    constructor(public status: number = 0) {
        super();
    }

    public serialize(): Uint8Array {
        return new Uint8Array([TransferChunkResponseMessage.Id, this.status]);
    }

    public static fromBytes(data: Uint8Array) {
        if (data[0] !== TransferChunkResponseMessage.Id) {
            throw new Error('Invalid TransferChunkResponseMessage');
        }
        return new TransferChunkResponseMessage(data[1]);
    }
}
