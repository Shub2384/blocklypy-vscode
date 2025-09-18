import { BaseMessageWithStatus } from './base-message';

export class ProgramFlowResponseMessage extends BaseMessageWithStatus {
    public static readonly Id = 0x1f;

    constructor(public status: number = 0) {
        super();
    }

    public serialize(): Uint8Array {
        return new Uint8Array([ProgramFlowResponseMessage.Id, this.status]);
    }

    public static fromBytes(data: Uint8Array): ProgramFlowResponseMessage {
        if (data[0] !== ProgramFlowResponseMessage.Id) {
            throw new Error('Invalid ProgramFlowResponseMessage');
        }
        return new ProgramFlowResponseMessage(data[1]);
    }
}
