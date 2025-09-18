import { bleLayer } from '../clients/ble-layer';
import { hasState, StateProp } from '../logic/state';

export async function stopUserProgramAsync() {
    if (!hasState(StateProp.Connected) || !bleLayer.client) {
        throw new Error(
            'No device selected. Please connect to a Pybricks device first.',
        );
    }

    await bleLayer.client.action_stop();
}
