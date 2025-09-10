import * as vscode from 'vscode';
import { TreeCommands } from '../extension/tree-commands';
import { BLEStatus, Device } from '../logic/ble';

const items: vscode.QuickPickItem[] = [];

async function _connect(name: string) {
    if (Device.Status !== BLEStatus.Disconnected && Device.Status !== BLEStatus.Error) {
        await Device.disconnectAsync();
    }

    // await Device.startScanningAsync();
    await Device.connectAsync(name, TreeCommands.refresh.bind(TreeCommands));
    // .finally(
    //     () => {
    //         Device.stopScanningAsync();
    //     },
    // );
}

export async function connectDeviceAsync(name: string) {
    if (name.length === 0) {
        throw new Error('No device name provided to connect to.');
    }

    if (Device.Status !== BLEStatus.Disconnected && Device.Status !== BLEStatus.Error) {
        await Device.disconnectAsync();
    }

    // if a name is provided, connect directly
    await _connect(name);
}
