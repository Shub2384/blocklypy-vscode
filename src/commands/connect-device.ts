import { Peripheral } from '@abandonware/noble';
import * as vscode from 'vscode';
import { TreeCommands } from '../extension/tree-commands';
import { Device } from '../logic/ble';

const items: vscode.QuickPickItem[] = [];

export async function connectDeviceByNameAsync(name: string) {
    await Device.startScanningAsync();
    await Device.connectAsync(name, TreeCommands.refresh.bind(TreeCommands)).finally(
        () => {
            Device.stopScanningAsync();
        },
    );
}

export async function connectDeviceAsync() {
    items.length = 0;
    const quickPick = vscode.window.createQuickPick();
    quickPick.title = 'Scanning...';
    quickPick.ignoreFocusOut = false;
    quickPick.onDidHide(async () => await Device.stopScanningAsync());
    quickPick.onDidAccept(async () => {
        const name = quickPick.selectedItems[0].label;
        quickPick.enabled = false;
        quickPick.title = `Connecting to ${name}...`;
        await connectDeviceByNameAsync(name);
        quickPick.busy = false;
        quickPick.hide();
    });
    quickPick.show();
    quickPick.busy = true;
    const addFoundDevice = (peripheral: Peripheral) => {
        const label = peripheral.advertisement.localName || peripheral.id;
        if (items.some((item) => item.label === label)) {
            return;
        }
        items.push({
            label: label,
        });
        quickPick.items = items;
    };

    Object.values(Device.AllDevices).forEach((peripheral) =>
        addFoundDevice(peripheral),
    );
    await Device.startScanningAsync((peripheral) => addFoundDevice(peripheral));
}
