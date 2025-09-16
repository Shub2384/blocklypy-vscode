import { Device } from '../logic/ble';
import { BuiltinProgramId, createStartUserProgramCommand } from '../pybricks/protocol';

export async function startUserProgramAsync(
    progId: number | BuiltinProgramId,
): Promise<void> {
    if (!Device.current) {
        throw new Error(
            'No device selected. Please connect to a Pybricks device first.',
        );
        return;
    }

    await Device.write(createStartUserProgramCommand(progId), false);
}
