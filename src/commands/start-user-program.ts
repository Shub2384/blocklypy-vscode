import { CommLayerManager } from '../clients/manager';
import { hasState, StateProp } from '../logic/state';

export async function startUserProgramAsync(slot_input?: number): Promise<void> {
    if (!hasState(StateProp.Connected)) {
        throw new Error('No device selected. Please connect to a device first.');
        return;
    }

    //TODO: check if we have a magic header and want to process that

    await CommLayerManager.client?.action_start(slot_input);
}
