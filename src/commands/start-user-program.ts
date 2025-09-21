import { bleLayer } from '../clients/ble-layer';
import { hasState, StateProp } from '../logic/state';

export async function startUserProgramAsync(slot_input?: number): Promise<void> {
    if (!hasState(StateProp.Connected)) {
        throw new Error('No device selected. Please connect to a device first.');
        return;
    }

    //TODO: check if we have a magic header and want to process that

    await bleLayer.client?.action_start(slot_input);
}
