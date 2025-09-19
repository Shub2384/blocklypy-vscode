import { RequestMessage } from './base-message';
import { DeviceNotificationResponseMessage } from './device-notification-response-message';

export class DeviceNotificationRequestMessage extends RequestMessage {
    public static readonly Id = 0x28;

    constructor(public intervalMs: number) {
        super();
    }

    public serialize(): Uint8Array {
        const buf = new Uint8Array(3);
        buf[0] = DeviceNotificationRequestMessage.Id;
        buf[1] = this.intervalMs & 0xff;
        buf[2] = (this.intervalMs >> 8) & 0xff;
        return buf;
    }

    public acceptsResponse(): number {
        return DeviceNotificationResponseMessage.Id;
    }
}
