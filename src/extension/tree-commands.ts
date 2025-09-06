import * as vscode from 'vscode';
import config from '../utils/config';
import { Device } from '../logic/ble';
import { BaseTreeDataProvider, BaseTreeItem, ITreeItem } from './tree-base';
import { PybricksCommand } from './commands';
import { ToCapialized } from './utils';

class CommandsTreeDataProvider extends BaseTreeDataProvider<BaseTreeItem> {
    getTreeItem(element: BaseTreeItem): BaseTreeItem {
        if (element.command?.command === PybricksCommand.DisconnectDevice) {
            element.label = Device.Current
                ? `Disconnect from ${Device.Current.advertisement.localName}`
                : 'Disconnect';
        } else if (
            element.command?.command === PybricksCommand.ConnectDeviceLastConnected
        ) {
            element.label = config.lastConnectedDevice
                ? `Connect to ${config.lastConnectedDevice}`
                : 'Connect Last Connected Device';
        } else if (element.command?.command === PybricksCommand.StatusPlaceHolder) {
            element.label =
                'Status: ' + ToCapialized(Device.Status ?? 'No Device Connected');
        }
        return element;
    }

    getChildren(element?: BaseTreeItem): vscode.ProviderResult<BaseTreeItem[]> {
        const elems = [] as ITreeItem[];
        if (!Device.Current) {
            elems.push({ command: PybricksCommand.ConnectDevice });
            if (config.lastConnectedDevice) {
                elems.push({ command: PybricksCommand.ConnectDeviceLastConnected });
            }
        } else {
            elems.push({ command: PybricksCommand.DisconnectDevice });
            elems.push({ command: PybricksCommand.CompileAndRun });
            if (!Device.IsProgramRunning) {
                elems.push({ command: PybricksCommand.StartUserProgram });
            } else {
                elems.push({ command: PybricksCommand.StopUserProgram });
            }
        }
        elems.push({ command: PybricksCommand.StatusPlaceHolder });

        return this.expandChildren(elems);
    }
}

export const TreeCommands = new CommandsTreeDataProvider();
vscode.window.registerTreeDataProvider('pybricks-vscommander-commands', TreeCommands);
