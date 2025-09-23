import { ConnectionManager } from '../communication/connection-manager';
import { hasState, StateProp } from '../logic/state';

export async function stopUserProgramAsync() {
    if (!hasState(StateProp.Connected) || !ConnectionManager.client) {
        throw new Error('No device selected. Please connect to a device first.');
    }

    await ConnectionManager.client.action_stop();
}
