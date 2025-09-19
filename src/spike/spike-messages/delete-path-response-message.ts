import { ResponseMessageWithStatus } from './base-message';

export class DeletePathResponseMessage extends ResponseMessageWithStatus {
    public static readonly Id = 0x4d;

    constructor(public status: number = 0) {
        super();
    }

    public static fromBytes(data: Uint8Array): DeletePathResponseMessage {
        const status = data[1];
        return new DeletePathResponseMessage(status);
    }
}
