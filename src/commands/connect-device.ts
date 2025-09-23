import * as vscode from 'vscode';
import { ConnectionManager } from '../communication/connection-manager';
import { showError } from '../extension/diagnostics';
import { hasState, StateProp } from '../logic/state';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function connectDeviceAsyncAny(...args: any[]): Promise<any> {
    const id = args[0] as string | undefined;
    const devtype = args[1] as string | undefined;
    if (!id || !devtype) return;

    await connectDeviceAsync(id, devtype);
}

export async function connectDeviceAsync(id: string, devtype: string) {
    if (!id?.length || !devtype?.length) {
        const items = ConnectionManager.allDevices.map(
            ({ name, devtype, metadata }) => ({
                label: name,
                description: devtype,
                devtype,
                id: metadata.id,
            }),
        );
        if (!items.length) {
            showError('No devices found. Please make sure Bluetooth is on.');
            return;
        }
        id =
            (await vscode.window.showQuickPick(items, { placeHolder: 'Select device' }))
                ?.id ?? '';
    }

    if (hasState(StateProp.Connected)) {
        await ConnectionManager.disconnect();

        // same device selected, will disappear, and will need to re-appear
        await ConnectionManager.waitTillDeviceAppearsAsync(id, devtype, 1000);
    }

    await vscode.window.withProgress(
        {
            location: { viewId: 'blocklypy-vscode-commands' },
            cancellable: false,
        },
        async () => {
            // if a name is provided, connect directly
            await ConnectionManager.connect(id, devtype);
        },
    );
}
