import { ResponseMessageWithStatus } from './base-message';

export class BeginFirmwareUpdateResponseMessage extends ResponseMessageWithStatus {
    public static readonly Id = 0x15;

    constructor(public status: number = 0) {
        super();
    }

    static fromBytes(data: Uint8Array): BeginFirmwareUpdateResponseMessage {
        const status = data[1];
        return new BeginFirmwareUpdateResponseMessage(status);
    }
}
