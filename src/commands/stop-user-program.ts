import { CommLayerManager } from '../clients/manager';
import { hasState, StateProp } from '../logic/state';

export async function stopUserProgramAsync() {
    if (!hasState(StateProp.Connected) || !CommLayerManager.client) {
        throw new Error('No device selected. Please connect to a device first.');
    }

    await CommLayerManager.client.action_stop();
}
