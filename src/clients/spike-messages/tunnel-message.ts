import { BaseMessage } from './base-message';

export class TunnelMessage extends BaseMessage {
    public static readonly Id = 0x32;

    constructor(public payload: Uint8Array = new Uint8Array()) {
        super();
    }

    public serialize(): Uint8Array {
        const payloadSize = this.payload.length;
        const buf = new Uint8Array(1 + 2 + payloadSize);
        buf[0] = TunnelMessage.Id;
        buf[1] = payloadSize & 0xff;
        buf[2] = (payloadSize >> 8) & 0xff;
        buf.set(this.payload, 3);
        return buf;
    }
}
