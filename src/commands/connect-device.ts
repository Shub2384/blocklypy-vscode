import * as vscode from 'vscode';
import { Device } from '../logic/ble';

const items: vscode.QuickPickItem[] = [];

export async function connectDeviceAsyncAny(...args: any[]): Promise<any> {
    await connectDeviceAsync(args[0]);
}

export async function connectDeviceAsync(name: string) {
    if (!name?.length) {
        const items = [...Device.allDevices.entries()].map(([name, metadata]) => ({
            label: name,
        }));
        if (!items.length) {
            vscode.window.showErrorMessage(
                'No devices found. Please make sure Bluetooth is on.',
            );
            return;
        }
        name =
            (await vscode.window.showQuickPick(items, { placeHolder: 'Select device' }))
                ?.label ?? '';
    }

    await vscode.window.withProgress(
        {
            location: { viewId: 'blocklypy-vscode-commands' },
            cancellable: false,
        },
        async () => {
            // if a name is provided, connect directly
            await Device.connectAsync(name);
        },
    );
}
