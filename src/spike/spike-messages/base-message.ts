// This file exports an abstract class BaseMessage with a static property Id, a method serialize that throws an error when not implemented, and a method deserialize that also throws an error when not implemented.

export abstract class BaseMessage {
    public static readonly Id: number;

    public get Id(): number {
        return (this.constructor as typeof BaseMessage).Id;
    }

    static fromBytes(data: Uint8Array): BaseMessage {
        throw new Error('Method not implemented.');
    }
}

export abstract class RequestMessage extends BaseMessage {
    abstract serialize(): Uint8Array;
    abstract acceptsResponse(): number;
}

export abstract class ResponseMessage extends BaseMessage {
    static fromBytes(data: Uint8Array): BaseMessage {
        throw new Error('Method not implemented.');
    }
}

export abstract class ResponseMessageWithStatus extends ResponseMessage {
    abstract get status(): number;

    public get success(): boolean {
        return this.status === 0x00;
    }
}
