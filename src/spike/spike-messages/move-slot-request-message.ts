import { RequestMessage } from './base-message';
import { MoveSlotResponseMessage } from './move-slot-response-message';

export class MoveSlotRequestMessage extends RequestMessage {
    public static readonly Id = 0x48;

    constructor(public slotNumberFrom: number, public slotNumberTo: number) {
        super();
    }

    public serialize(): Uint8Array {
        return new Uint8Array([
            MoveSlotRequestMessage.Id,
            this.slotNumberFrom,
            this.slotNumberTo,
        ]);
    }

    public acceptsResponse(): number {
        return MoveSlotResponseMessage.Id;
    }
}
