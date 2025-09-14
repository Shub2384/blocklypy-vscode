import { Device } from '../logic/ble';
import { hasState, StateProp } from '../logic/state';
import { stopUserProgramAsync } from './stop-user-program';

export async function disconnectDeviceAsync() {
    if (!Device.current) {
        throw new Error('No device is currently connected.');
    }

    if (hasState(StateProp.Running)) {
        await stopUserProgramAsync();
    }

    await Device.disconnectAsync();
}
