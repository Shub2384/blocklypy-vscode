import { BaseMessageWithStatus } from './base-message';

export class StartFileUploadResponseMessage extends BaseMessageWithStatus {
    public static readonly Id = 0x0d;

    constructor(public status: number = 0) {
        super();
    }

    public serialize(): Uint8Array {
        return new Uint8Array([StartFileUploadResponseMessage.Id, this.status]);
    }

    public static fromBytes(data: Uint8Array): StartFileUploadResponseMessage {
        if (data[0] !== StartFileUploadResponseMessage.Id) {
            throw new Error('Invalid StartFileUploadResponseMessage');
        }
        return new StartFileUploadResponseMessage(data[1]);
    }
}
