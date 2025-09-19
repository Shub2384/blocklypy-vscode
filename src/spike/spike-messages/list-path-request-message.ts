import { RequestMessage } from './base-message';
import { ListPathResponseMessage } from './list-path-response-message';

export class ListPathRequestMessage extends RequestMessage {
    public static readonly Id = 0x4a;

    constructor(public path: string, public slotNumber: number) {
        super();
    }

    public serialize(): Uint8Array {
        // path: up to 31 bytes + 0 terminator, slotNumber: 1 byte
        const encoder = new TextEncoder();
        const pathBytes = encoder.encode(this.path).slice(0, 31);
        const arr = new Uint8Array(1 + pathBytes.length + 1 + 1);
        arr[0] = ListPathRequestMessage.Id;
        arr.set(pathBytes, 1);
        arr[1 + pathBytes.length] = 0; // null terminator
        arr[1 + pathBytes.length + 1] = this.slotNumber & 0xff;
        return arr;
    }

    public static fromBytes(data: Uint8Array): ListPathRequestMessage {
        let end = 1;
        while (end < data.length && data[end] !== 0) end++;
        const decoder = new TextDecoder();
        const path = decoder.decode(data.slice(1, end));
        const slotNumber = data[end + 1];
        return new ListPathRequestMessage(path, slotNumber);
    }

    public acceptsResponse(): number {
        return ListPathResponseMessage.Id;
    }
}
