import { ResponseMessage } from './base-message';

export class ConsoleNotificationMessage extends ResponseMessage {
    public static readonly Id = 0x21;

    constructor(public text: string = '') {
        super();
    }

    public static fromBytes(data: Uint8Array) {
        if (data[0] !== ConsoleNotificationMessage.Id) {
            throw new Error('Invalid StdoutMessage');
        }
        const text = new TextDecoder().decode(data.slice(1, data.length - 1));
        return new ConsoleNotificationMessage(text);
    }
}
