import * as vscode from 'vscode';
import { EXTENSION_KEY } from '../const';
import Config from '../utils/config';
import { Commands } from './commands';
import { BaseTreeDataProvider, BaseTreeItem } from './tree-base';

class SettingsTreeDataProvider extends BaseTreeDataProvider<BaseTreeItem> {
    getChildren(element?: BaseTreeItem): vscode.ProviderResult<BaseTreeItem[]> {
        const elems = [
            {
                command: Commands.ToggleAutoConnect,
                check: Config.enableAutoConnect,
            },
            {
                command: Commands.ToggleAutoStart,
                check: Config.enableAutostart,
            },
        ];
        return this.expandChildren(elems);
    }
}

const SettingsTree = new SettingsTreeDataProvider();
function registerSettingsTree(context: vscode.ExtensionContext) {
    SettingsTree.init(context);

    const settingsTreeView = vscode.window.createTreeView(EXTENSION_KEY + '-settings', {
        treeDataProvider: SettingsTree,
    });

    settingsTreeView.onDidChangeCheckboxState(
        (e: vscode.TreeCheckboxChangeEvent<BaseTreeItem>) => {
            e.items.forEach(([elem, state1]) => {
                const state = state1 === vscode.TreeItemCheckboxState.Checked;
                switch (elem.command?.command) {
                    case Commands.ToggleAutoConnect:
                        Config.setEnableAutoConnect(state).then(SettingsTree.refresh);
                        break;
                    case Commands.ToggleAutoStart:
                        Config.setEnableAutostart(state).then(SettingsTree.refresh);
                        break;
                }
            });
        },
    );

    return settingsTreeView;
}

export { registerSettingsTree, SettingsTree as settingsTreeData };
