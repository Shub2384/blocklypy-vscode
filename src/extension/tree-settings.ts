import * as vscode from 'vscode';
import { EXTENSION_KEY } from '../const';
import Config from '../utils/config';
import { SettingsToggleCommandsMap } from './commands';
import { BaseTreeDataProvider, TreeItemData } from './tree-base';

class SettingsTreeDataProvider extends BaseTreeDataProvider<TreeItemData> {
    getChildren(element?: TreeItemData): vscode.ProviderResult<TreeItemData[]> {
        if (element) return [];

        const elems = SettingsToggleCommandsMap.map(
            ([configKey, title, command, tooltip]) => {
                return {
                    title: title?.replace('Toggle ', ''),
                    tooltip,
                    command,
                    check: Config.getConfigValue<boolean>(configKey, false) === true,
                };
            },
        );
        return elems;
    }
}

const SettingsTree = new SettingsTreeDataProvider();
function registerSettingsTree(context: vscode.ExtensionContext) {
    SettingsTree.init(context);

    const treeview = vscode.window.createTreeView(EXTENSION_KEY + '-settings', {
        treeDataProvider: SettingsTree,
    });

    treeview.onDidChangeCheckboxState(
        (e: vscode.TreeCheckboxChangeEvent<TreeItemData>) => {
            e.items.forEach(([elem]) => {
                vscode.commands.executeCommand(elem.command);
            });
        },
    );

    context.subscriptions.push(treeview);
}

export { registerSettingsTree, SettingsTree };
