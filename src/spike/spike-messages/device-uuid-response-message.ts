import { ResponseMessage } from './base-message';

export class DeviceUuidResponseMessage extends ResponseMessage {
    public static readonly Id = 0x1b;

    constructor(public uuid: string = '') {
        super();
    }

    public static fromBytes(data: Uint8Array): DeviceUuidResponseMessage {
        if (data[0] !== DeviceUuidResponseMessage.Id) {
            throw new Error('Invalid DeviceUuidResponseMessage');
        }
        const uuidBytes = data.slice(1, 17);
        const uuid = Array.from(uuidBytes)
            .map((b, i) =>
                [4, 6, 8, 10].includes(i)
                    ? '-' + b.toString(16).padStart(2, '0')
                    : b.toString(16).padStart(2, '0'),
            )
            .join('');
        return new DeviceUuidResponseMessage(uuid);
    }
}
