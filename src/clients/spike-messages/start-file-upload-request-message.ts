import { BaseMessage } from './base-message';
import { StartFileUploadResponseMessage } from './start-file-upload-response-message';

export class StartFileUploadRequestMessage extends BaseMessage {
    public static readonly Id = 0x0c;

    constructor(public filename: string, public slot: number, public crc32: number) {
        super();
    }

    public serialize(): Uint8Array {
        const nameBuf = new Uint8Array(32);
        const filenameBuf = new TextEncoder().encode(this.filename);
        nameBuf.set(filenameBuf.slice(0, 32));
        const buf = new Uint8Array(1 + 32 + 1 + 4);
        buf[0] = StartFileUploadRequestMessage.Id;
        buf.set(nameBuf, 1);
        buf[33] = this.slot;
        buf[34] = this.crc32 & 0xff;
        buf[35] = (this.crc32 >> 8) & 0xff;
        buf[36] = (this.crc32 >> 16) & 0xff;
        buf[37] = (this.crc32 >> 24) & 0xff;
        return buf;
    }

    public acceptsResponse(): number {
        return StartFileUploadResponseMessage.Id;
    }
}
