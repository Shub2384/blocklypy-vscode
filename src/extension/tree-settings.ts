import * as vscode from 'vscode';
import config from '../utils/config';
import { PybricksCommand } from './commands';
import { BaseTreeItem, BaseTreeDataProvider } from './tree-base';

class SettingsTreeDataProvider extends BaseTreeDataProvider<BaseTreeItem> {
    getChildren(element?: BaseTreeItem): vscode.ProviderResult<BaseTreeItem[]> {
        const elems = [
            {
                command: PybricksCommand.ToggleAutoConnect,
                check: config.enableAutoConnect,
            },
            { command: PybricksCommand.ToggleAutoStart, check: config.enableAutostart },
        ];
        return this.expandChildren(elems);
    }
}

const settingsTreeData = new SettingsTreeDataProvider();

const settingsTreeView = vscode.window.createTreeView('pybricks-vscommander-settings', {
    treeDataProvider: settingsTreeData,
});

settingsTreeView.onDidChangeCheckboxState(
    (e: vscode.TreeCheckboxChangeEvent<BaseTreeItem>) => {
        e.items.forEach(([elem, state1]) => {
            const state = state1 === vscode.TreeItemCheckboxState.Checked;
            switch (elem.command?.command) {
                case PybricksCommand.ToggleAutoConnect:
                    config.setEnableAutoConnect(state).then(settingsTreeData.refresh);
                    break;
                case PybricksCommand.ToggleAutoStart:
                    config.setEnableAutostart(state).then(settingsTreeData.refresh);
                    break;
            }
        });
    },
);

export { settingsTreeView, settingsTreeData };
