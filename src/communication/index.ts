export class DeviceMetadata {
    constructor(public devtype: string) {}
    public validTill: number = Number.MAX_VALUE;
    public get rssi(): number | undefined {
        return undefined;
    }
    public get broadcastAsString(): string | undefined {
        return undefined;
    }
    public get name(): string | undefined {
        throw new Error('Not implemented');
    }
    public get id(): string {
        return DeviceMetadata.generateId(this.devtype, this.name ?? '');
    }
    public static generateId(devtype: string, id: string): string {
        return `${devtype}:${id}`;
    }
}

export enum ConnectionState {
    Initializing = 'initializing',
    Disconnected = 'disconnected',
    Connecting = 'connecting',
    Connected = 'connected',
    Disconnecting = 'disconnecting',
}
