import { RequestMessage } from './base-message';
import { StartFileDownloadResponseMessage } from './start-file-download-response-message';

export class StartFileDownloadRequestMessage extends RequestMessage {
    public static readonly Id = 0x0e;

    constructor(public filename: string, public slotNumber: number) {
        super();
    }

    public serialize(): Uint8Array {
        // filename: up to 31 bytes + 0 terminator, slotNumber: 1 byte
        const encoder = new TextEncoder();
        const nameBytes = encoder.encode(this.filename).slice(0, 31);
        const arr = new Uint8Array(1 + nameBytes.length + 1 + 1);
        arr[0] = StartFileDownloadRequestMessage.Id;
        arr.set(nameBytes, 1);
        arr[1 + nameBytes.length] = 0; // null terminator
        arr[1 + nameBytes.length + 1] = this.slotNumber & 0xff;
        return arr;
    }

    public acceptsResponse(): number {
        return StartFileDownloadResponseMessage.Id;
    }
}
