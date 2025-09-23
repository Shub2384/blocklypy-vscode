import { CommLayerManager } from '../clients/manager';
import { hasState, StateProp } from '../logic/state';
import { stopUserProgramAsync } from './stop-user-program';

export async function disconnectDeviceAsync() {
    if (!hasState(StateProp.Connected)) {
        throw new Error('No device is currently connected.');
    }

    if (hasState(StateProp.Running)) {
        await stopUserProgramAsync();
    }

    await CommLayerManager.disconnect();
}
