import { DeviceMetadata } from '.';
import { showWarning } from '../extension/diagnostics';
import { BaseLayer } from './base-layer';
import { BLELayer } from './ble-layer';
import { USBLayer } from './usb-layer';

// TODO: remove _client / activeCLient from layer -> move it to the manager //!!

export class CommLayerManager {
    private static busy = false;
    private static layers: BaseLayer[] = [];
    private static bleLayer: BLELayer | undefined = undefined;
    private static usbLayer: USBLayer | undefined = undefined;
    // private static listeners: ((device: DeviceMetadata) => void)[] = [];
    // public static onDevice = new EventEmitter<DeviceMetadata>();

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

    public static initialize() {
        // Initialization code here
        this.bleLayer = new BLELayer();
        this.usbLayer = new USBLayer();
        this.layers.push(this.bleLayer, this.usbLayer);
    }

    public static async startup() {
        const startupfns = this.layers.map((layer) => layer.startup());
        await Promise.all(startupfns);
    }

    public static async connect(id: string, devtype: string) {
        if (this.busy) throw new Error('Manager is busy');
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
        // if (this.busy) throw new Error('Manager is busy');
        // this.busy = true;
        // try {
        //     const client = this.client;
        //     if (client) await client.disconnect();
        // } catch (error) {
        //     showWarning(`Failed to disconnect: ${String(error)}`);
        // } finally {
        //     this.busy = false;
        // }
        for (const layer of this.layers) {
            if (layer.client?.connected) await layer.disconnect();
        }
    }

    public static finalize() {
        // Cleanup code here
        this.bleLayer?.stopScanning();
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

    public static addListener(fn: (device: DeviceMetadata) => void) {
        for (const layer of this.layers) layer.addListener(fn);
    }

    public static removeListener(fn: (device: DeviceMetadata) => void) {
        for (const layer of this.layers) layer.removeListener(fn);
    }
}

CommLayerManager.initialize();
