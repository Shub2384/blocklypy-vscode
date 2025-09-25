import * as vscode from 'vscode';
import { ConnectionState, DeviceMetadata } from '.';
import { connectDeviceAsync } from '../commands/connect-device';
import { logDebug } from '../extension/debug-channel';
import { showWarning } from '../extension/diagnostics';
import { CommandsTree } from '../extension/tree-commands';
import { DevicesTree } from '../extension/tree-devices';
import { hasState, setState, StateProp } from '../logic/state';
import Config from '../utils/config';
import {
    BaseLayer,
    ConnectionStateChangeEvent,
    DeviceChangeEvent,
} from './layers/base-layer';
import { BLELayer } from './layers/ble-layer';
import { USBLayer } from './layers/usb-layer';

// TODO: remove _client / activeCLient from layer -> move it to the manager //!!

export class ConnectionManager {
    private static busy = false;
    private static layers: BaseLayer[] = [];
    private static _deviceChange = new vscode.EventEmitter<DeviceChangeEvent>();

    public static get allDevices() {
        const devices: {
            id: string;
            name: string;
            devtype: string;
            metadata: DeviceMetadata;
        }[] = [];
        for (const layer of this.layers) {
            for (const [name, metadata] of layer.allDevices.entries()) {
                devices.push({
                    id: metadata.id,
                    name,
                    devtype: metadata.devtype,
                    metadata,
                });
            }
        }
        return devices;
    }

    public static get client() {
        return this.layers.find((layer) => layer.client)?.client;
    }

    public static async initialize() {
        // Initialization code here

        for (const layerCtor of [BLELayer, USBLayer]) {
            try {
                const instance = new layerCtor(
                    (event) => ConnectionManager.handleStateChange(event),
                    (event) => ConnectionManager.handleDeviceChange(event),
                );
                await instance.initialize();
                this.layers.push(instance);
                console.log(`Successfully initialized ${layerCtor.name}.`);
            } catch (e) {
                console.error(`Failed to initialize ${layerCtor.name}:`, e);
            }
        }
    }

    public static async connect(id: string, devtype: string) {
        if (this.busy) throw new Error('Connection manager is busy, try again later');
        this.busy = true;
        try {
            for (const layer of this.layers) {
                if (layer.supportsDevtype(devtype)) {
                    await layer.connect(id, devtype);
                    return;
                }
            }
        } catch (error) {
            showWarning(`Failed to connect to device ${id}: ${String(error)}`);
        } finally {
            this.busy = false;
        }
    }

    public static async disconnect() {
        if (this.busy) throw new Error('Connection manager is busy, try again later');
        this.busy = true;
        try {
            for (const layer of this.layers) {
                if (layer.client?.connected) {
                    await layer.disconnect();
                    return;
                }
            }
        } catch (error) {
            showWarning(`Failed to disconnect from device: ${String(error)}`);
        } finally {
            this.busy = false;
        }
    }

    public static finalize() {
        this.stopScanning();
    }

    private static handleStateChange(event: ConnectionStateChangeEvent) {
        if (event.client === this.client && event.client !== undefined) {
            setState(
                StateProp.Connected,
                event.state === ConnectionState.Connected &&
                    event.client.connected === true,
            );
            setState(StateProp.Connecting, event.state === ConnectionState.Connecting);
        } else {
            console.log(
                `Ignoring state change from non-active client: ${event.client?.id} (${event.state})`,
            );
            return;
        }

        CommandsTree.refresh();
        // DevicesTree.refreshCurrentItem();
        DevicesTree.refresh();
    }

    private static handleDeviceChange(event: DeviceChangeEvent) {
        ConnectionManager._deviceChange.fire(event);
    }

    public static async startScanning() {
        setState(StateProp.Scanning, true);

        await Promise.all(
            this.layers.map(async (layer) => {
                if (!layer.ready) return;
                layer.stopScanning();
                await layer.startScanning();
            }),
        );

        DevicesTree.refresh();
    }

    public static stopScanning() {
        this.layers.forEach((layer) => layer.stopScanning());
        setState(StateProp.Scanning, false);
        DevicesTree.refresh();
    }

    public static waitForReadyAsync(timeout: number = 10000) {
        // Wait for any layer to be ready using Promise.race
        const readyPromises = this.layers
            .map((layer) => layer.waitForReadyAsync?.(timeout))
            .filter(Boolean);
        return Promise.all(readyPromises);
    }

    public static async waitTillDeviceAppearsAsync(
        id: string,
        devtype: string,
        timeout: number = 10000,
    ): Promise<void> {
        // TODO: race
        const targetlayer = this.layers.find((l) => l.supportsDevtype(devtype));

        if (targetlayer)
            await targetlayer.waitTillDeviceAppearsAsync(id, devtype, timeout);
    }

    public static onDeviceChange(
        fn: (event: DeviceChangeEvent) => void,
    ): vscode.Disposable {
        return this._deviceChange.event(fn);
    }

    public static async autoConnectLastDevice() {
        logDebug('BlocklyPy Commander started up successfully.', true);

        await ConnectionManager.waitForReadyAsync();
        // await Device.startScanning();

        // autoconnect to last connected device
        if (Config.deviceAutoConnect && Config.deviceLastConnected) {
            const id = Config.deviceLastConnected;
            const { devtype } = Config.decodeDeviceKey(id);

            await ConnectionManager.waitTillDeviceAppearsAsync(id, devtype, 15000);
            if (!hasState(StateProp.Connected) && !hasState(StateProp.Connecting))
                await connectDeviceAsync(id, devtype);
        }
    }
}
