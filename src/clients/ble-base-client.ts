import { DeviceMetadata } from '.';
import { logDebug } from '../extension/debug-channel';
import { clearPythonErrors } from '../extension/diagnostics';
import { BaseClient } from './base-client';

export abstract class BleBaseClient extends BaseClient {
    protected async connectWorker(
        device: DeviceMetadata,
        onDeviceUpdated: (device: DeviceMetadata) => void,
        onDeviceRemoved: (device: DeviceMetadata, name?: string) => void,
    ) {
        await super.connectWorker(device, onDeviceUpdated, onDeviceRemoved);

        const peripheral = device.peripheral;
        const name = peripheral.advertisement.localName;

        await peripheral.connectAsync();
        this._exitStack.push(() => {
            peripheral.removeAllListeners('disconnect');
            if (onDeviceRemoved) onDeviceRemoved(device, name);
        });

        peripheral.on('disconnect', () => void this.handleDisconnectAsync(name));
    }

    private async handleDisconnectAsync(name: string) {
        logDebug(`Disconnected from ${name}`);
        clearPythonErrors();
        // Do not call disconnectAsync recursively
        await this.runExitStack();
        this._device = undefined;
    }

    public async disconnect() {
        try {
            console.log('Disconnecting...');
            const peripheral = this._device?.peripheral;
            await this.runExitStack();
            peripheral?.disconnect();
            this._device = undefined;
        } catch (error) {
            logDebug(`Error during disconnect: ${String(error)}`);
        }
    }
}
