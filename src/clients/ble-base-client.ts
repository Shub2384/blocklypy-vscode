import { DeviceMetadata } from '.';
import { logDebug } from '../extension/debug-channel';
import { clearPythonErrors } from '../extension/diagnostics';
import { BaseClient } from './base-client';
import { DeviceMetadataWithPeripheral } from './ble-layer';

export abstract class BleBaseClient extends BaseClient {
    protected async connectWorker(
        onDeviceUpdated: (device: DeviceMetadata) => void,
        onDeviceRemoved: (device: DeviceMetadata, id?: string) => void,
    ) {
        await super.connectWorker(onDeviceUpdated, onDeviceRemoved);

        const metadata = this.metadata;
        const device = metadata.peripheral;
        if (!device) throw new Error('No peripheral in metadata');
        const id = device.advertisement.localName;

        await device.connectAsync();
        this._exitStack.push(() => {
            device.removeAllListeners('disconnect');
            if (onDeviceRemoved) onDeviceRemoved(metadata, id);
        });

        device.on('disconnect', () => void this.handleDisconnectAsync(id));
    }

    private async handleDisconnectAsync(id: string) {
        logDebug(`Disconnected from ${id}`);
        clearPythonErrors();
        // Do not call disconnectAsync recursively
        await this.runExitStack();
        this._metadata = undefined;
    }

    public async disconnect() {
        try {
            console.log('Disconnecting...');
            const metadata = this._metadata as DeviceMetadataWithPeripheral;
            const peripheral = metadata?.peripheral;
            await this.runExitStack();
            peripheral?.disconnect();
            this._metadata = undefined;
        } catch (error) {
            logDebug(`Error during disconnect: ${String(error)}`);
        }
    }

    public get connected() {
        const device = this._metadata as DeviceMetadataWithPeripheral | undefined;
        return device?.peripheral?.state === 'connected';
    }

    protected get metadata() {
        return this._metadata as DeviceMetadataWithPeripheral;
    }
}
