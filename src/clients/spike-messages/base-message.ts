// This file exports an abstract class BaseMessage with a static property Id, a method serialize that throws an error when not implemented, and a method deserialize that also throws an error when not implemented.

export abstract class BaseMessage {
    public static readonly Id: number;

    public get Id(): number {
        return (this.constructor as typeof BaseMessage).Id;
    }

    public serialize(): Uint8Array {
        throw new Error('Method not implemented.');
    }

    // This is just a type hint; actual implementation must be in each subclass.
    public static fromBytes(data: Uint8Array): BaseMessage {
        throw new Error('Not implemented');
    }

    // This is just a type hint; actual implementation must be in each subclass.
    public acceptsResponse(): number {
        throw new Error('Not implemented');
    }
}

export abstract class BaseMessageWithStatus extends BaseMessage {
    abstract get status(): number;

    public get success(): boolean {
        return this.status === 0x00;
    }
}
