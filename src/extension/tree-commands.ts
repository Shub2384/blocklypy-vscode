import * as vscode from 'vscode';
import { EXTENSION_KEY } from '../const';
import { Device } from '../logic/ble';
import { getStateString, hasState, StateProp } from '../logic/state';
import { Commands } from './commands';
import { BaseTreeDataProvider, TreeItemData } from './tree-base';
import { ToCapialized } from './utils';

class CommandsTreeDataProvider extends BaseTreeDataProvider<TreeItemData> {
    getTreeItem(element: TreeItemData): vscode.TreeItem {
        const retval = super.getTreeItem(element);

        // customize label for some commands
        if (element.command === Commands.DisconnectDevice) {
            retval.label = Device.current
                ? `Disconnect from ${Device.current.peripheral.advertisement.localName}`
                : 'Disconnect';
        } else if (element.command === Commands.StatusPlaceHolder) {
            retval.label = 'Status: ' + ToCapialized(getStateString());
        }
        return retval;
    }

    getChildren(element?: TreeItemData): vscode.ProviderResult<TreeItemData[]> {
        if (element) return [];

        const elems = [] as TreeItemData[];
        if (Device.current) {
            elems.push({ command: Commands.CompileAndRun });
            elems.push({
                command: hasState(StateProp.Running)
                    ? Commands.StopUserProgram
                    : Commands.StartUserProgram,
            });
            elems.push({ command: Commands.DisconnectDevice });
        }
        elems.push({ command: Commands.StatusPlaceHolder });

        return elems;
    }
}

export const CommandsTree = new CommandsTreeDataProvider();
export function registerCommandsTree(context: vscode.ExtensionContext) {
    // vscode.window.registerTreeDataProvider(EXTENSION_KEY + '-commands', TreeCommands);
    CommandsTree.init(context);

    const treeview = vscode.window.createTreeView(EXTENSION_KEY + '-commands', {
        treeDataProvider: CommandsTree,
    });

    context.subscriptions.push(treeview);
}
