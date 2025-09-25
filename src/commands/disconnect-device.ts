import * as vscode from 'vscode';
import { ConnectionManager } from '../communication/connection-manager';
import { hasState, StateProp } from '../logic/state';
import { stopUserProgramAsync } from './stop-user-program';

export async function disconnectDeviceAsync() {
    if (!hasState(StateProp.Connected)) {
        throw new Error('No device is currently connected.');
    }

    if (hasState(StateProp.Running)) {
        await stopUserProgramAsync();
    }

    await vscode.window.withProgress(
        {
            location: { viewId: 'blocklypy-vscode-commands' },
            title: `Disconnecting from device...`,
        },
        async () => {
            await ConnectionManager.disconnect();
        },
    );
}
