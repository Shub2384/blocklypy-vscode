import { BaseMessage } from './base-message';

export class ConsoleNotificationMessage extends BaseMessage {
    public static readonly Id = 0x21;

    constructor(public text: string = '') {
        super();
    }

    public serialize(): Uint8Array {
        const encoder = new TextEncoder();
        const textBytes = encoder.encode(this.text);
        const buf = new Uint8Array(1 + textBytes.length + 1);
        buf[0] = ConsoleNotificationMessage.Id;
        buf.set(textBytes, 1);
        buf[buf.length - 1] = 0x00; // Null terminator
        return buf;
    }

    public static fromBytes(data: Uint8Array) {
        if (data[0] !== ConsoleNotificationMessage.Id) {
            throw new Error('Invalid StdoutMessage');
        }
        const text = new TextDecoder().decode(data.slice(1, data.length - 1));
        return new ConsoleNotificationMessage(text);
    }
}
