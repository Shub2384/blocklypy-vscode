import { RequestMessage } from './base-message';
import { SetHubNameResponseMessage } from './set-hub-name-response-message';

export class SetHubNameRequestMessage extends RequestMessage {
    public static readonly Id = 0x16;

    constructor(public newHubName: string) {
        super();
        if (newHubName.length > 30) {
            throw new Error('Hub name must not exceed 30 characters.');
        }
    }

    public serialize(): Uint8Array {
        // newHubName: up to 30 bytes + 0 terminator
        const encoder = new TextEncoder();
        const nameBytes = encoder.encode(this.newHubName).slice(0, 30);
        const arr = new Uint8Array(1 + nameBytes.length + 1);
        arr[0] = SetHubNameRequestMessage.Id;
        arr.set(nameBytes, 1);
        arr[1 + nameBytes.length] = 0; // null terminator
        return arr;
    }

    public acceptsResponse(): number {
        return SetHubNameResponseMessage.Id;
    }
}
