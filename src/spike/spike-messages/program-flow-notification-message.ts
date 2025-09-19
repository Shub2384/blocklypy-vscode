import { ResponseMessage } from './base-message';

export class ProgramFlowNotificationMessage extends ResponseMessage {
    public static readonly Id = 0x20;

    constructor(public action: number = 0) {
        super();
    }

    public static fromBytes(data: Uint8Array): ProgramFlowNotificationMessage {
        if (data[0] !== ProgramFlowNotificationMessage.Id) {
            throw new Error('Invalid ProgramActionMessage');
        }
        const action = data[1];
        return new ProgramFlowNotificationMessage(action);
    }
}
