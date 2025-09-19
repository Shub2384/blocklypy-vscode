import { ResponseMessageWithStatus } from './base-message';

export class StartFileDownloadResponseMessage extends ResponseMessageWithStatus {
    public static readonly Id = 0x0f;

    constructor(public status: number = 0, public fileCrc: number = 0) {
        super();
    }

    public static fromBytes(data: Uint8Array): StartFileDownloadResponseMessage {
        const status = data[1];
        const fileCrc = data[2] | (data[3] << 8) | (data[4] << 16) | (data[5] << 24);
        return new StartFileDownloadResponseMessage(status, fileCrc);
    }
}
