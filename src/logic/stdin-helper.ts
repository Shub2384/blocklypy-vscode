import { createWriteStdinCommand } from '../pybricks/protocol';
import { Device } from './ble';
import { hasState, StateProp } from './state';

export async function sendDataToHubStdin(message: string): Promise<void> {
    if (!hasState(StateProp.Connected)) throw new Error('Not connected to a device');
    // withState(StateProp.Connected)

    const buffer = await Device.readCapabilities();
    const maxWriteSize = buffer?.readUInt16LE(0);
    if (!maxWriteSize) return;

    const maxBleWriteSize = maxWriteSize;
    // assert(maxBleWriteSize >= 20, 'bad maxBleWriteSize');
    const value = message;
    const encoder = new TextEncoder();
    const data = encoder.encode(value);

    for (let i = 0; i < data.length; i += maxBleWriteSize) {
        await Device.write(createWriteStdinCommand(data.buffer as ArrayBuffer), false);
    }
}
