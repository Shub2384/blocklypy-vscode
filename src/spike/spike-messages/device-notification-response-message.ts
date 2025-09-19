import { ResponseMessageWithStatus } from './base-message';

export class DeviceNotificationResponseMessage extends ResponseMessageWithStatus {
    public static readonly Id = 0x29;

    constructor(public status: number = 0) {
        super();
    }

    public static fromBytes(data: Uint8Array): DeviceNotificationResponseMessage {
        const status = data[1];
        return new DeviceNotificationResponseMessage(status);
    }
}
