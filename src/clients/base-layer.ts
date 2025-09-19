import { ConnectionStatus, DeviceMetadata } from '.';
import { logDebug } from '../extension/debug-channel';
import { CommandsTree } from '../extension/tree-commands';
import { DevicesTree } from '../extension/tree-devices';
import { setState, StateProp } from '../logic/state';
import { BaseClient } from './base-client';

export abstract class BaseLayer {
    private _status: ConnectionStatus = ConnectionStatus.Disconnected;
    protected _allDevices = new Map<string, DeviceMetadata>();
    protected _client: BaseClient | undefined = undefined;
    protected _exitStack: (() => Promise<void>)[] = [];
    private _listeners: ((device: DeviceMetadata) => void)[] = [];

    constructor() {}

    public get client() {
        return this._client;
    }

    public get status() {
        return this._status;
    }

    public async connect(name: string) {
        if (!this._client) throw new Error('Client not initialized');
        if (this._client?.connected) await this._client.disconnect();

        const metadata = this._allDevices.get(name);
        if (!metadata) throw new Error(`Device ${name} not found.`);

        try {
            this.status = ConnectionStatus.Connecting;
            await this._client.connect(
                metadata,
                (device) => {
                    this._listeners.forEach((fn) => fn(device));
                },
                (device, name) => {
                    // need to remove this as pybricks creates a random BLE id on each reconnect
                    if (name) this._allDevices.delete(name);

                    setState(StateProp.Connected, false);
                    setState(StateProp.Connecting, false);
                    setState(StateProp.Running, false);
                    DevicesTree.refresh();
                },
            );

            this._exitStack.push(async () => {
                this.status = ConnectionStatus.Disconnected;
                this._client = undefined;
            });

            this.status = ConnectionStatus.Connected;
        } catch (error) {
            this.status = ConnectionStatus.Disconnected;
            await this.runExitStack();
            this._client = undefined;
        }

        if (this.status !== ConnectionStatus.Connected) {
            this.disconnect();
            throw new Error(`Failed to connect to ${name}: Timeout`);
        }
    }

    public async disconnect() {
        if (!this._client) return;

        try {
            this.status = ConnectionStatus.Disconnecting;
            await this._client.disconnect();
            await this.runExitStack();
            this._client = undefined;
        } catch (error) {
            logDebug(`Error during disconnectAsync: ${error}`);
        }
        this.status = ConnectionStatus.Disconnected;
    }

    private async runExitStack() {
        for (const fn of this._exitStack) {
            try {
                await fn();
            } catch (error) {
                logDebug(`Error during cleanup function : ${error}`);
            }
        }
        this._exitStack = [];
    }

    public addListener(fn: (device: DeviceMetadata) => void) {
        if (this._listeners.indexOf(fn) === -1) {
            this._listeners.push(fn);
        }
    }
    public removeListener(fn: (device: DeviceMetadata) => void) {
        const idx = this._listeners.indexOf(fn);
        if (idx !== -1) {
            this._listeners.splice(idx, 1);
        }
    }

    private set status(newStatus: ConnectionStatus) {
        // TODO: this should not be per layet // maybe there should be an acitve layer later?
        // now it is ok, as we only have bleLayer
        setState(
            StateProp.Connected,
            newStatus === ConnectionStatus.Connected &&
                this._client?.connected === true,
        );
        setState(StateProp.Connecting, newStatus === ConnectionStatus.Connecting);

        if (this._status === newStatus) return;
        this._status = newStatus;

        CommandsTree.refresh();
        DevicesTree.refreshCurrentItem();
    }

    protected get allDevices() {
        return this._allDevices;
    }

    public getDeviceByName(name: string): DeviceMetadata | undefined {
        return this._allDevices.get(name);
    }
}
