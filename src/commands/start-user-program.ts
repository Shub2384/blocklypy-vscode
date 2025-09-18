import { bleLayer } from '../clients/ble-layer';
import { hasState, StateProp } from '../logic/state';
import { BuiltinProgramId } from '../pybricks/protocol';

export async function startUserProgramAsync(
    progId: number | BuiltinProgramId,
): Promise<void> {
    if (!hasState(StateProp.Connected)) {
        throw new Error(
            'No device selected. Please connect to a Pybricks device first.',
        );
        return;
    }

    await bleLayer.client?.action_start(progId);
}
