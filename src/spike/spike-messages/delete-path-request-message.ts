import { RequestMessage } from './base-message';
import { DeletePathResponseMessage } from './delete-path-response-message';

export class DeletePathRequestMessage extends RequestMessage {
    public static readonly Id = 0x4c;

    constructor(public path: string, public slotNumber: number) {
        super();
    }

    public serialize(): Uint8Array {
        // path: up to 31 bytes + 0 terminator, slotNumber: 1 byte
        const encoder = new TextEncoder();
        const pathBytes = encoder.encode(this.path).slice(0, 31);
        const arr = new Uint8Array(1 + pathBytes.length + 1 + 1);
        arr[0] = DeletePathRequestMessage.Id;
        arr.set(pathBytes, 1);
        arr[1 + pathBytes.length] = 0; // null terminator
        arr[1 + pathBytes.length + 1] = this.slotNumber & 0xff;
        return arr;
    }

    public acceptsResponse(): number {
        return DeletePathResponseMessage.Id;
    }
}
