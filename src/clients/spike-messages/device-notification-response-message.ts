import { BaseMessageWithStatus } from './base-message';

export class DeviceNotificationResponseMessage extends BaseMessageWithStatus {
    public static readonly Id = 0x29;

    constructor(public status: number = 0) {
        super();
    }

    public serialize(): Uint8Array {
        return new Uint8Array([DeviceNotificationResponseMessage.Id, this.status]);
    }

    public static fromBytes(data: Uint8Array): DeviceNotificationResponseMessage {
        if (data[0] !== DeviceNotificationResponseMessage.Id) {
            throw new Error('Invalid DeviceNotificationResponseMessage');
        }
        return new DeviceNotificationResponseMessage(data[1]);
    }
}
