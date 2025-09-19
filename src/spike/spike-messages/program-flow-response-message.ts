import { ResponseMessageWithStatus } from './base-message';

export class ProgramFlowResponseMessage extends ResponseMessageWithStatus {
    public static readonly Id = 0x1f;

    constructor(public status: number = 0) {
        super();
    }

    public static fromBytes(data: Uint8Array): ProgramFlowResponseMessage {
        const status = data[1];
        return new ProgramFlowResponseMessage(status);
    }
}
