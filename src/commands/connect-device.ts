import * as vscode from 'vscode';
import { bleLayer } from '../clients/ble-layer';
import { showErrorAsync } from '../extension/diagnostics';
import { hasState, StateProp } from '../logic/state';

// const items: vscode.QuickPickItem[] = [];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function connectDeviceAsyncAny(...args: any[]): Promise<any> {
    await connectDeviceAsync(args[0] as string);
}

export async function connectDeviceAsync(name: string) {
    if (!name?.length) {
        const items = [...bleLayer.allDevices.entries()].map(([name, _metadata]) => ({
            label: name,
        }));
        if (!items.length) {
            await showErrorAsync('No devices found. Please make sure Bluetooth is on.');
            return;
        }
        name =
            (await vscode.window.showQuickPick(items, { placeHolder: 'Select device' }))
                ?.label ?? '';
    }

    if (hasState(StateProp.Connected)) {
        await bleLayer.disconnect();

        // same device selected, will disappear, and will need to re-appear
        await bleLayer.waitTillDeviceAppearsAsync(name, 1000);
    }

    await vscode.window.withProgress(
        {
            location: { viewId: 'blocklypy-vscode-commands' },
            cancellable: false,
        },
        async () => {
            // if a name is provided, connect directly
            await bleLayer.connect(name);
        },
    );
}
