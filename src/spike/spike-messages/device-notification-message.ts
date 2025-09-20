import {
    DeviceNotificationPayload,
    parseDeviceNotificationPayloads,
} from '../utils/device-notification';
import { ResponseMessage } from './base-message';

export class DeviceNotificationMessage extends ResponseMessage {
    public static readonly Id = 0x3c;

    constructor(public payloads: DeviceNotificationPayload[]) {
        super();
    }

    public static fromBytes(data: Uint8Array): DeviceNotificationMessage {
        const payloads = parseDeviceNotificationPayloads(data) || [];
        return new DeviceNotificationMessage(payloads);
    }
}
