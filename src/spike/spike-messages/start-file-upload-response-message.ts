import { ResponseMessageWithStatus } from './base-message';

export class StartFileUploadResponseMessage extends ResponseMessageWithStatus {
    public static readonly Id = 0x0d;

    constructor(public status: number = 0) {
        super();
    }

    public static fromBytes(data: Uint8Array): StartFileUploadResponseMessage {
        const status = data[1];
        return new StartFileUploadResponseMessage(status);
    }
}
