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
        this._exitStack.push(async () => {
            peripheral.removeAllListeners('disconnect');
            onDeviceRemoved && onDeviceRemoved(device, name);
        });

        peripheral.on('disconnect', async () => {
            // if (!this.connected) return;

            logDebug(`Disconnected from ${name}`);
            await clearPythonErrors();
            // Do not call disconnectAsync recursively
            this.runExitStack();
            this._device = undefined;
        });
    }
}
