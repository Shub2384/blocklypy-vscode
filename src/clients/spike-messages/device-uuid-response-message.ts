import { BaseMessage } from './base-message';

export class DeviceUuidResponseMessage extends BaseMessage {
    public static readonly Id = 0x1b;

    constructor(public uuid: string = '') {
        super();
    }

    public serialize(): Uint8Array {
        // Not typically sent from client, so not implemented
        throw new Error('Serialize not implemented for DeviceUuidResponseMessage');
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
