import * as vscode from 'vscode';
import { EXTENSION_KEY } from '../const';
import { Device } from '../logic/ble';
import Config from '../utils/config';
import { Commands } from './commands';
import { BaseTreeDataProvider, BaseTreeItem, ITreeItem } from './tree-base';
import { ToCapialized } from './utils';

class CommandsTreeDataProvider extends BaseTreeDataProvider<BaseTreeItem> {
    getTreeItem(element: BaseTreeItem): BaseTreeItem {
        if (element.command?.command === Commands.DisconnectDevice) {
            element.label = Device.Current
                ? `Disconnect from ${Device.Current.advertisement.localName}`
                : 'Disconnect';
        } else if (element.command?.command === Commands.ConnectDeviceLastConnected) {
            element.label = Config.lastConnectedDevice
                ? `Connect to ${Config.lastConnectedDevice}`
                : 'Connect Last Connected Device';
        } else if (element.command?.command === Commands.StatusPlaceHolder) {
            element.label =
                'Status: ' + ToCapialized(Device.Status ?? 'No Device Connected');
        }
        return element;
    }

    getChildren(element?: BaseTreeItem): vscode.ProviderResult<BaseTreeItem[]> {
        const elems = [] as ITreeItem[];
        // const isDevelopmentMode = process.env.NODE_ENV === 'development';
        if (!Device.Current) {
            // if (isDevelopmentMode) {
            //     elems.push({ command: Commands.Compile });
            // }
            elems.push({ command: Commands.ConnectDevice });
            if (Config.lastConnectedDevice) {
                elems.push({ command: Commands.ConnectDeviceLastConnected });
            }
        } else {
            elems.push({ command: Commands.DisconnectDevice });
            elems.push({ command: Commands.CompileAndRun });
            if (!Device.IsProgramRunning) {
                elems.push({ command: Commands.StartUserProgram });
            } else {
                elems.push({ command: Commands.StopUserProgram });
            }
        }
        elems.push({ command: Commands.StatusPlaceHolder });

        return this.expandChildren(elems);
    }
}

export const TreeCommands = new CommandsTreeDataProvider();
export function registerCommandsTree(context: vscode.ExtensionContext) {
    vscode.window.registerTreeDataProvider(EXTENSION_KEY + '-commands', TreeCommands);
    TreeCommands.init(context);

    // const commandsTreeView = vscode.window.createTreeView(EXTENSION_KEY+'-commands', {
    //     treeDataProvider: TreeCommands,
    // });

    // return commandsTreeView;
}
