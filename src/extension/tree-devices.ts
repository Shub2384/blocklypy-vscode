import * as vscode from 'vscode';
import { EXTENSION_KEY } from '../const';
import { Device, DeviceMetadata } from '../logic/ble';
import { Commands } from './commands';
import { BaseTreeDataProvider, TreeItemData } from './tree-base';

const DEVICE_VISIBILITY_TIMEOUT = 30000; // milliseconds
const DEVICE_VISIBILITY_CHECK_INTERVAL = 10000; // milliseconds

export interface TreeItemDeviceData extends TreeItemData {
    lastSeen?: number;
}

class DevicesTreeDataProvider extends BaseTreeDataProvider<TreeItemDeviceData> {
    public deviceMap = new Map<string, TreeItemDeviceData>();

    getChildren(
        element?: TreeItemDeviceData,
    ): vscode.ProviderResult<TreeItemDeviceData[]> {
        if (element) {
            return [];
        }

        if (this.deviceMap.size > 0) return Array.from(this.deviceMap.values());
        else {
            return [
                {
                    title: 'No devices found',
                    command: '',
                },
            ];
        }
    }
}

const DevicesTree = new DevicesTreeDataProvider();
function registerDevicesTree(context: vscode.ExtensionContext): vscode.Disposable {
    // vscode.window.registerTreeDataProvider(EXTENSION_KEY + '-devices', DevicesTree);
    DevicesTree.init(context);

    const treeview = vscode.window.createTreeView(EXTENSION_KEY + '-devices', {
        treeDataProvider: DevicesTree,
    });

    const addDevice = (device: DeviceMetadata) => {
        const peripheral = device.peripheral;
        const name = peripheral.advertisement.localName;
        if (!name) return;

        const item = DevicesTree.deviceMap.get(name) ?? ({} as TreeItemDeviceData);
        const isNew = item.command === undefined;
        Object.assign(item, {
            name,
            title: name,
            command: Commands.ConnectDevice,
            commandArguments: [name],
            icon: getSignalIcon(peripheral.rssi),
            description: device.lastBroadcast
                ? `${device.lastBroadcast.data} on ch:${device.lastBroadcast.channel}`
                : '',
            lastSeen: Date.now(),
        } as TreeItemDeviceData);

        if (isNew) {
            DevicesTree.deviceMap.set(name, item);
            DevicesTree.refresh();
        } else {
            DevicesTree.refreshItem(item);
        }
    };
    Device.addListener(addDevice);

    // Periodically remove devices not seen for X seconds
    const timer = setInterval(() => {
        const now = Date.now();
        let changed = false;
        for (const [name, item] of DevicesTree.deviceMap.entries()) {
            const lastSeen = item.lastSeen as number | undefined;
            if (lastSeen && now - lastSeen > DEVICE_VISIBILITY_TIMEOUT) {
                DevicesTree.deviceMap.delete(name);
                changed = true;
            }
        }
        if (changed) {
            DevicesTree.refresh();
        }
    }, DEVICE_VISIBILITY_CHECK_INTERVAL);

    return vscode.Disposable.from(
        treeview,
        new vscode.Disposable(() => {
            Device.removeListener(addDevice);
            clearInterval(timer);
        }),
    );
}

function getSignalIcon(rssi?: number) {
    if (rssi === undefined) return '';
    const levels = [-85, -70, -60, -45];
    const idx = levels.findIndex((level) => rssi <= level);
    const icon = `asset/signal-${idx === -1 ? 4 : idx}.svg`;
    return icon;
}

export { DevicesTree, registerDevicesTree };
