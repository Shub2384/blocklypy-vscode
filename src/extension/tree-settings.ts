import * as vscode from 'vscode';
import { EXTENSION_KEY } from '../const';
import Config from '../utils/config';
import { Commands } from './commands';
import { BaseTreeDataProvider, TreeItemData } from './tree-base';

class SettingsTreeDataProvider extends BaseTreeDataProvider<TreeItemData> {
    getChildren(element?: TreeItemData): vscode.ProviderResult<TreeItemData[]> {
        if (element) return [];

        const elems = [
            {
                command: Commands.ToggleAutoConnect,
                tooltip: 'Auto-connect to last device.',
                check: Config.autoConnect === true,
            },
            {
                command: Commands.ToggleAutoStart,
                tooltip:
                    "Auto-start user program on save with '# LEGO autostart' in first line.",
                check: Config.autostart === true,
            },
            {
                command: Commands.ToggleAutoClearTerminal,
                tooltip: 'Auto-clear terminal before running.',
                check: Config.autoClearTerminal === true,
            },
        ];
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
            e.items.forEach(([elem, state1]) => {
                const state = state1 === vscode.TreeItemCheckboxState.Checked;
                switch (elem.command) {
                    case Commands.ToggleAutoConnect:
                        Config.setAutoConnect(state).then(SettingsTree.refresh);
                        break;
                    case Commands.ToggleAutoStart:
                        Config.setAutostart(state).then(SettingsTree.refresh);
                        break;
                    case Commands.ToggleAutoClearTerminal:
                        Config.setAutoClearTerminal(state).then(SettingsTree.refresh);
                        break;
                }
            });
        },
    );

    context.subscriptions.push(treeview);
}

export { registerSettingsTree, SettingsTree as settingsTreeData };
