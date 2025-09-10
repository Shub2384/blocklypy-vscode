import { Peripheral } from '@abandonware/noble';
import * as vscode from 'vscode';
import { EXTENSION_KEY } from '../const';
import { Device } from '../logic/ble';
import { BaseTreeDataProvider, BaseTreeItem, TreeItemData } from './tree-base';
import { get } from 'http';
import path from 'path';
import { title } from 'process';
import { Commands } from './commands';

interface IDeviceLocalCacheItem extends TreeItemData {
    name: string;
    rssi: number;
}
const deviceMap = new Map<string, IDeviceLocalCacheItem>();

class DevicesTreeDataProvider extends BaseTreeDataProvider<IDeviceLocalCacheItem> {
    getChildren(
        element?: IDeviceLocalCacheItem,
    ): vscode.ProviderResult<IDeviceLocalCacheItem[]> {
        if (element) return [];

        return Array.from(deviceMap.values());
    }
}

const DevicesTree = new DevicesTreeDataProvider();
function registerDevicesTree(context: vscode.ExtensionContext) {
    DevicesTree.init(context);

    const treeView = vscode.window.createTreeView(EXTENSION_KEY + '-devices', {
        treeDataProvider: DevicesTree,
    });

    const addDevice = (peripheral: Peripheral) => {
        const name = peripheral.advertisement.localName;
        if (!name) return;

        if (deviceMap.has(name)) {
            const item = deviceMap.get(name)!;
            item.rssi = peripheral.rssi;
            item.icon = getSignalIcon(peripheral.rssi);
            DevicesTree.refreshItem(item);
        } else {
            const item = {
                name,
                rssi: peripheral.rssi,
                command: 'blocklypy-vscode.connectDevice',
                title: name,
                icon: getSignalIcon(peripheral.rssi),
                commandArguments: [name],
            } satisfies IDeviceLocalCacheItem;
            deviceMap.set(name, item);
            DevicesTree.refresh();
        }
    };
    Device.addListener(addDevice);

    return treeView;
}

function getSignalIcon(rssi: number) {
    const levels = [-85, -70, -60, -45];
    const idx = levels.findIndex((level) => rssi <= level);
    const icon = `asset/signal-${idx === -1 ? 4 : idx}.svg`;
    return icon;
}

export { registerDevicesTree, DevicesTree };
