import * as vscode from 'vscode';
import { Device } from '../logic/ble';
import { createStopUserProgramCommand } from '../pybricks/protocol';

export async function stopUserProgramAsync() {
    if (!Device.Current) {
        throw new Error(
            'No device selected. Please connect to a Pybricks device first.',
        );
    }

    await Device.write(createStopUserProgramCommand(), false);
}
