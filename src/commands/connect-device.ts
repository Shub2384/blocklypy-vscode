import * as vscode from 'vscode';
import { TreeCommands } from '../extension/tree-commands';
import { Device } from '../logic/ble';
import { StateProp, withState } from '../logic/state';

const items: vscode.QuickPickItem[] = [];

export async function connectDeviceAsync(name: string) {
    if (name.length === 0) throw new Error('No device name provided to connect to.');

    await withState(StateProp.Connected, async () => {
        await Device.disconnectAsync();
    })();

    // if a name is provided, connect directly
    await Device.connectAsync(name, TreeCommands.refresh.bind(TreeCommands));
}
