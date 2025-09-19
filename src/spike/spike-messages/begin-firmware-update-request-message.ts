import { RequestMessage } from './base-message';
import { BeginFirmwareUpdateResponseMessage } from './begin-firmware-update-response-message';

export class BeginFirmwareUpdateRequestMessage extends RequestMessage {
    public static readonly Id = 0x14;

    constructor(public fileSha: Uint8Array, public fileCrc: number) {
        super();
    }

    public serialize(): Uint8Array {
        // fileSha: 20 bytes, fileCrc: 4 bytes
        const arr = new Uint8Array(1 + 20 + 4);
        arr[0] = BeginFirmwareUpdateRequestMessage.Id;
        arr.set(this.fileSha.slice(0, 20), 1);
        arr.set(
            [
                (this.fileCrc >>> 0) & 0xff,
                (this.fileCrc >>> 8) & 0xff,
                (this.fileCrc >>> 16) & 0xff,
                (this.fileCrc >>> 24) & 0xff,
            ],
            21,
        );
        return arr;
    }

    public acceptsResponse(): number {
        return BeginFirmwareUpdateResponseMessage.Id;
    }
}
