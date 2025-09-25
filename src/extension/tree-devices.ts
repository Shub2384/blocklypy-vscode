import * as vscode from 'vscode';
import { ConnectionManager } from '../communication/connection-manager';
import { DeviceChangeEvent } from '../communication/layers/base-layer';
import { EXTENSION_KEY } from '../const';
import { hasState, StateProp } from '../logic/state';
import { Commands } from './commands';
import { BaseTreeDataProvider, TreeItemData } from './tree-base';

const DEVICE_VISIBILITY_CHECK_INTERVAL = 1000; // milliseconds

export interface TreeItemDeviceData extends TreeItemData {
    validTill?: number;
}

class DevicesTreeDataProvider extends BaseTreeDataProvider<TreeItemDeviceData> {
    public deviceMap = new Map<string, TreeItemDeviceData>();

    getTreeItem(element: TreeItemDeviceData): vscode.TreeItem {
        const item = super.getTreeItem(element);
        if (element.title && element.id) {
            const active =
                element?.id === ConnectionManager.client?.id &&
                ConnectionManager.client?.connected
                    ? '🔵 '
                    : '';
            item.label = `${active}${element.title} [${element.contextValue}]`;
        }
        return item;
    }

    getChildren(
        element?: TreeItemDeviceData,
    ): vscode.ProviderResult<TreeItemDeviceData[]> {
        if (element) {
            return [];
        }

        if (this.deviceMap.size > 0) {
            return Array.from(this.deviceMap.values());
        } else {
            if (hasState(StateProp.Scanning)) {
                return [
                    {
                        title: 'Scanning for devices...',
                        icon: '$(loading~spin)',
                        command: Commands.StopScanning,
                    },
                ];
            } else {
                return [
                    {
                        title: 'No devices found.',
                        icon: '$(circle-slash)',
                        command: Commands.StartScanning,
                        description: 'Click to start scanning',
                    },
                ];
            }
        }
    }

    refreshCurrentItem() {
        const id = ConnectionManager.client?.id;
        if (!id) return;
        const item = this.deviceMap.get(id);
        if (item) this.refreshItem(item);
    }
}

const DevicesTree = new DevicesTreeDataProvider();
function registerDevicesTree(context: vscode.ExtensionContext) {
    // vscode.window.registerTreeDataProvider(EXTENSION_KEY + '-devices', DevicesTree);
    DevicesTree.init(context);

    const treeview = vscode.window.createTreeView(EXTENSION_KEY + '-devices', {
        treeDataProvider: DevicesTree,
    });

    treeview.onDidChangeVisibility(async (e) => {
        if (e.visible) {
            try {
                await ConnectionManager.startScanning();

                if (!hasState(StateProp.Connected))
                    await ConnectionManager.autoConnectLastDevice();
            } catch {
                // noop - will fail with the startup
            }
        } else {
            ConnectionManager.stopScanning();
        }
    });

    const addDevice = (event: DeviceChangeEvent) => {
        const metadata = event.metadata;
        const id = metadata.id;
        if (!id) return;

        const item = DevicesTree.deviceMap.get(id) ?? ({} as TreeItemDeviceData);
        const isNew = item.command === undefined;
        const name = metadata.name ?? 'Unknown';
        const validTill = metadata.validTill;
        Object.assign(item, {
            name,
            id,
            title: name,
            command: Commands.ConnectDevice,
            commandArguments: [id, metadata.devtype],
            description: metadata.broadcastAsString
                ? `⛁ ${metadata.broadcastAsString}`
                : '',
            //  on ch:${device.lastBroadcast.channel}
            validTill,
            contextValue: metadata.devtype,
        } as TreeItemDeviceData);

        if (metadata.rssi !== undefined) {
            item.icon = getSignalIcon(metadata.rssi);
        }

        if (isNew) {
            DevicesTree.deviceMap.set(id, item);
            DevicesTree.refresh();
        } else {
            DevicesTree.refreshItem(item);
        }
    };
    context.subscriptions.push(ConnectionManager.onDeviceChange(addDevice));

    // Periodically remove devices not seen for X seconds
    // Except for currently connected device, that will not broadcast, yet it should stay in the list
    const timer = setInterval(() => {
        const now = Date.now();
        let changed = false;
        for (const [id, item] of DevicesTree.deviceMap.entries()) {
            if (ConnectionManager.client?.id === id) continue;

            if (now > (item.validTill ?? 0)) {
                DevicesTree.deviceMap.delete(id);
                changed = true;
            }
        }
        if (changed) {
            DevicesTree.refresh();
        }
    }, DEVICE_VISIBILITY_CHECK_INTERVAL);

    context.subscriptions.push(
        treeview,
        new vscode.Disposable(() => clearInterval(timer)),
    );
}

function getSignalIcon(rssi?: number) {
    if (rssi === undefined) return undefined;
    const levels = [-85, -70, -60, -45];
    // const levels = [-95, -80, -70, -60]; // chrome values
    const idx = levels.findIndex((level) => rssi <= level);
    const icon = `asset/icons/signal-${idx === -1 ? 4 : idx}.svg`;
    return icon;
}

export { DevicesTree, registerDevicesTree };
