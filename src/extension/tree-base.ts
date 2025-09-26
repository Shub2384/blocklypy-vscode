import * as vscode from 'vscode';
import { CommandMetaDataEntry, getCommandsFromPackageJson } from './commands';
import { getIcon } from './utils';

export interface TreeItemData {
    id?: string;
    command: string;
    title?: string;
    tooltip?: string | vscode.MarkdownString;
    description?: string;
    icon?: string;
    check?: boolean;
    commandArguments?: unknown[];
    collapsibleState?: vscode.TreeItemCollapsibleState;
    contextValue?: string;
}

export class BaseTreeItem extends vscode.TreeItem {
    constructor(
        label: string,
        extension_context?: vscode.ExtensionContext,
        icon?: string | { light: string; dark: string },
        id?: string,
        command?: string,
        commandArguments?: unknown[],
        check?: boolean,

        // tooltip?: string,
        // description?: string,
        // collapsibleState: vscode.TreeItemCollapsibleState = vscode
        //     .TreeItemCollapsibleState.None,
    ) {
        super(label);
        if (icon) this.iconPath = getIcon(icon, extension_context);

        this.id = id;
        // this.tooltip = tooltip;
        // this.tooltip = label;
        if (check !== undefined) {
            this.checkboxState = check
                ? vscode.TreeItemCheckboxState.Checked
                : vscode.TreeItemCheckboxState.Unchecked;
        }
        if (command) {
            this.command = {
                command,
                title: label,
                arguments: commandArguments,
            } as vscode.Command;
        }
        // this.description = description;
        // this.collapsibleState = collapsibleState;
    }
}

export abstract class BaseTreeDataProvider<T extends TreeItemData>
    implements vscode.TreeDataProvider<T>
{
    protected _onDidChangeTreeData: vscode.EventEmitter<T | undefined | void> =
        new vscode.EventEmitter<T | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<T | undefined | void> =
        this._onDidChangeTreeData.event;
    protected context?: vscode.ExtensionContext;
    protected commands: CommandMetaDataEntry[] = [];

    init(context: vscode.ExtensionContext) {
        this.context = context;
        this.commands = getCommandsFromPackageJson(context);
    }

    getTreeItem(element: T): vscode.TreeItem {
        // read the commands from the extension package.json
        let cmd = {
            ...this.commands?.find((c) => String(c.command) === element.command),
            ...element,
        };
        const title = element.title ?? cmd.title ?? '';

        const item = new BaseTreeItem(
            title,
            this.context,
            cmd.icon,
            cmd.id,
            cmd.command,
            cmd.commandArguments,
            cmd.check,
        );
        item.tooltip = cmd.tooltip;
        item.description = cmd.description;
        item.collapsibleState = cmd.collapsibleState;
        item.contextValue = element.contextValue;

        // Object.assign(item, cmd);
        return item;
    }
    abstract getChildren(element?: T): vscode.ProviderResult<T[]>;

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    refreshItem(item: T) {
        this._onDidChangeTreeData.fire(item);
    }
}
