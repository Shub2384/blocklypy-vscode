import * as vscode from 'vscode';
import { Device } from '../logic/ble';
import { StateProp, withState } from '../logic/state';

const items: vscode.QuickPickItem[] = [];

export async function connectDeviceAsyncAny(...args: any[]): Promise<any> {
    await connectDeviceAsync(args[0]);
}

export async function connectDeviceAsync(name: string) {
    if (name.length === 0) throw new Error('No device name provided to connect to.');

    await vscode.window.withProgress(
        {
            location: { viewId: 'blocklypy-vscode-commands' },
            cancellable: false,
        },
        async () => {
            await withState(StateProp.Connected, async () => {
                await Device.disconnectAsync();
            })();

            // if a name is provided, connect directly
            await Device.connectAsync(name);
        },
    );
}
