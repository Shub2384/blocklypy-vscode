import { ConnectionStatus, DeviceMetadata } from '.';
import { logDebug } from '../extension/debug-channel';
import { CommandsTree } from '../extension/tree-commands';
import { DevicesTree } from '../extension/tree-devices';
import { setState, StateProp } from '../logic/state';
import { withTimeout } from '../utils/async';
import { BaseClient } from './base-client';

// TODO: remove _client / activeCLient from layer -> move it to the manager //!!

export abstract class BaseLayer {
    private _status: ConnectionStatus = ConnectionStatus.Disconnected;
    protected _allDevices = new Map<string, DeviceMetadata>();
    protected _client: BaseClient | undefined = undefined;
    protected _exitStack: (() => Promise<void> | void)[] = [];
    protected _listeners: ((device: DeviceMetadata) => void)[] = [];
    protected _isStartedUp: boolean = false;

    public get client() {
        return this._client;
    }

    public get status() {
        return this._status;
    }

    public supportsDevtype(_devtype: string) {
        return false;
    }

    public startup(): Promise<void> {
        this._isStartedUp = true;
        return Promise.resolve();
    }

    public async connect(id: string, devtype: string) {
        if (!this._client) throw new Error('Client not initialized');
        if (this._client?.connected) await this._client.disconnect();

        const metadata = this._allDevices.get(id);
        if (!metadata || metadata.devtype !== devtype)
            throw new Error(`Device ${id} not found with ${devtype}.`);

        try {
            this.status = ConnectionStatus.Connecting;
            await withTimeout(
                this._client
                    .connect(
                        (device) => {
                            this._listeners.forEach((fn) => fn(device));
                        },
                        (_device, id) => {
                            // need to remove this as pybricks creates a random BLE id on each reconnect
                            if (id) this._allDevices.delete(id);

                            this.status = ConnectionStatus.Disconnected;
                            // setState(StateProp.Connected, false);
                            // setState(StateProp.Connecting, false);
                            // setState(StateProp.Running, false);
                            DevicesTree.refresh();
                        },
                    )
                    .catch((err) => {
                        console.error('Error during client.connect:', err);
                        throw err;
                    }),
                10000,
            );

            this._exitStack.push(() => {
                this.status = ConnectionStatus.Disconnected;
                this._client = undefined;
            });

            if (this._client.connected !== true)
                throw new Error('Client failed to connect for unknown reason.');

            this.status = ConnectionStatus.Connected;
        } catch (error) {
            console.error('Error during connect:', error);
            this.status = ConnectionStatus.Disconnected;
            await this.runExitStack();
            await this.disconnect();
            this._client = undefined;
        }

        if (this.status !== ConnectionStatus.Connected) {
            await this.disconnect();
            throw new Error(`Failed to connect to ${id}: Timeout`);
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
            logDebug(`Error during disconnectAsync: ${String(error)}`);
        }
        this.status = ConnectionStatus.Disconnected;
    }

    private async runExitStack() {
        for (const fn of this._exitStack) {
            try {
                await fn();
            } catch (error) {
                logDebug(`Error during cleanup function : ${String(error)}`);
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

    public get allDevices() {
        return this._allDevices;
    }

    public hasDevice(id: string): boolean {
        return this._allDevices.has(id);
    }

    public getDeviceById(id: string): DeviceMetadata | undefined {
        return this._allDevices.get(id);
    }

    public waitForReadyAsync(_timeout: number = 10000): Promise<void> {
        throw new Error('Not implemented');
    }

    public waitTillDeviceAppearsAsync(
        id: string,
        devtype: string,
        timeout: number = 10000,
    ): Promise<void> | void {
        if (this._allDevices.has(id)) return;

        const start = Date.now();
        return new Promise<void>((res, rej) => {
            const listener = (device: DeviceMetadata) => {
                if (device.id === id && device.devtype === devtype) {
                    this.removeListener(listener);
                    res();
                } else if (Date.now() - start > timeout) {
                    // TODO: revisit
                    this.removeListener(listener);
                    rej(new Error('Timeout waiting for device'));
                }
            };
            this.addListener(listener);
        });
    }
}
