import { RequestMessage } from './base-message';
import { StartFileUploadResponseMessage } from './start-file-upload-response-message';

export class StartFileUploadRequestMessage extends RequestMessage {
    public static readonly Id = 0x0c;

    constructor(public filename: string, public slot: number, public crc32: number) {
        super();
    }

    public serialize(): Uint8Array {
        const filenameBuf = new TextEncoder().encode(this.filename);
        const namelen = Math.min(filenameBuf.length, 31);
        // 1 byte for Id, up to 31 bytes for filename, 1 byte for null-termination, 1 byte for slot, 4 bytes for crc32
        const buf = new Uint8Array(1 + namelen + 1 + 1 + 4).fill(0);

        buf[0] = StartFileUploadRequestMessage.Id;
        buf.set(filenameBuf.slice(0, namelen), 1);
        buf[1 + namelen] = 0; // null-termination
        buf[1 + namelen + 1] = this.slot;
        buf[1 + namelen + 2] = this.crc32 & 0xff;
        buf[1 + namelen + 3] = (this.crc32 >> 8) & 0xff;
        buf[1 + namelen + 4] = (this.crc32 >> 16) & 0xff;
        buf[1 + namelen + 5] = (this.crc32 >> 24) & 0xff;

        return buf;
    }

    public acceptsResponse(): number {
        return StartFileUploadResponseMessage.Id;
    }
}
