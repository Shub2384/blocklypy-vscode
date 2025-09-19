import { ResponseMessageWithStatus } from './base-message';

export class StartFirmwareUploadResponseMessage extends ResponseMessageWithStatus {
    public static readonly Id = 0x0b;

    constructor(public status: number = 0, public bytesReceived: number = 0) {
        super();
    }

    public static fromBytes(data: Uint8Array): StartFirmwareUploadResponseMessage {
        const status = data[1];
        const bytesReceived =
            data[2] | (data[3] << 8) | (data[4] << 16) | (data[5] << 24);
        return new StartFirmwareUploadResponseMessage(status, bytesReceived);
    }
}
