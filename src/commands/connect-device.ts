import { Peripheral } from '@abandonware/noble';
import * as vscode from 'vscode';
import { TreeCommands } from '../extension/tree-commands';
import { BLEStatus, Device } from '../logic/ble';
import path from 'path';
import { EXTENSION_ID } from '../extension';

const items: vscode.QuickPickItem[] = [];

async function _connect(name: string) {
    if (Device.Status !== BLEStatus.Disconnected && Device.Status !== BLEStatus.Error) {
        await Device.disconnectAsync();
    }

    await Device.startScanningAsync();
    await Device.connectAsync(name, TreeCommands.refresh.bind(TreeCommands)).finally(
        () => {
            Device.stopScanningAsync();
        },
    );
}

export async function connectDeviceAsync(name?: string) {
    if (Device.Status !== BLEStatus.Disconnected && Device.Status !== BLEStatus.Error) {
        await Device.disconnectAsync();
    }

    // if a name is provided, connect directly
    if (name && name?.length !== 0) {
        await _connect(name);
        return;
    }

    // otherwise, show a quick pick to select a device
    items.length = 0;
    const quickPick = vscode.window.createQuickPick();
    quickPick.title = 'Scanning...';
    quickPick.ignoreFocusOut = false;
    quickPick.onDidHide(async () => {
        await Device.stopScanningAsync();
        if (selectedDeviceName) await _connect(selectedDeviceName);
        quickPick.dispose();
    });
    let selectedDeviceName: string | undefined = undefined;
    quickPick.onDidAccept(() => {
        selectedDeviceName = quickPick.selectedItems[0].label;
        quickPick.enabled = false;
        quickPick.hide();
    });
    quickPick.show();
    quickPick.busy = true;
    const addFoundDevice = (peripheral: Peripheral) => {
        if (!peripheral.advertisement.localName) return;
        const itemidx = items.findIndex(
            (item) => item.label === peripheral.advertisement.localName,
        );

        const item = {
            label: peripheral.advertisement.localName,
            description: `${peripheral.rssi} dBm`,
            iconPath: getSignalIcon(peripheral.rssi),
        };
        if (itemidx !== -1) items[itemidx] = item;
        else items.push(item);

        quickPick.items = items;
    };

    const removeStaleDevice = (peripheral: Peripheral) => {
        const ridx = items.findIndex(
            (item) => item.label === peripheral.advertisement.localName,
        );
        if (ridx !== -1) items.splice(ridx, 1);

        quickPick.items = items;
    };

    Object.values(Device.AllDevices).forEach((peripheral) =>
        addFoundDevice(peripheral),
    );
    await Device.startScanningAsync((peripheral) => addFoundDevice(peripheral));
}

function getSignalIcon(rssi: number) {
    const levels = [-85, -70, -60, -45];
    const idx = levels.findIndex((level) => rssi <= level);
    const icon = `signal-${idx === -1 ? 4 : idx}`;
    const url = vscode.Uri.file(
        path.join(
            vscode.extensions.getExtension(EXTENSION_ID)!.extensionPath,
            'asset',
            icon + '.svg',
        ),
    );
    return { light: url, dark: url };
}
