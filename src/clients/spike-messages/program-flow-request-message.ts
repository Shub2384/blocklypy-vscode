import { BaseMessage } from './base-message';
import { ProgramFlowResponseMessage } from './program-flow-response-message';

export class ProgramFlowRequestMessage extends BaseMessage {
    public static readonly Id = 0x1e;

    constructor(public start: boolean, public slot?: number) {
        super();
    }

    public serialize(): Uint8Array {
        return new Uint8Array([
            ProgramFlowRequestMessage.Id,
            this.start ? 0x00 : 0x01,
            this.slot ?? 0,
        ]);
    }

    public acceptsResponse(): number {
        return ProgramFlowResponseMessage.Id;
    }
}
