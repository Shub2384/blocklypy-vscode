import { ResponseMessage } from './base-message';

export class ListPathResponseMessage extends ResponseMessage {
    public static readonly Id = 0x4b;

    constructor(public items: string[]) {
        super();
    }

    public static fromBytes(data: Uint8Array): ListPathResponseMessage {
        // data[1..] is a sequence of null-terminated strings
        let offset = 1;
        const items: string[] = [];
        const decoder = new TextDecoder();
        while (offset < data.length) {
            let end = offset;
            while (end < data.length && data[end] !== 0) end++;
            if (end === offset) break;
            items.push(decoder.decode(data.slice(offset, end)));
            offset = end + 1;
        }
        return new ListPathResponseMessage(items);
    }
}
