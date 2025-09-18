import { BaseMessage } from './base-message';
import { TransferChunkResponseMessage } from './transfer-chunk-response-message';

export class TransferChunkRequestMessage extends BaseMessage {
    public static readonly Id = 0x10;

    constructor(public runningCrc32: number, public chunk: Uint8Array) {
        super();
    }

    public serialize(): Uint8Array {
        const chunkSize = this.chunk.length;
        const buf = new Uint8Array(1 + 4 + 2 + chunkSize);
        buf[0] = TransferChunkRequestMessage.Id;
        buf[1] = this.runningCrc32 & 0xff;
        buf[2] = (this.runningCrc32 >> 8) & 0xff;
        buf[3] = (this.runningCrc32 >> 16) & 0xff;
        buf[4] = (this.runningCrc32 >> 24) & 0xff;
        buf[5] = chunkSize & 0xff;
        buf[6] = (chunkSize >> 8) & 0xff;
        buf.set(this.chunk, 7);
        return buf;
    }

    public acceptsResponse(): number {
        return TransferChunkResponseMessage.Id;
    }
}
