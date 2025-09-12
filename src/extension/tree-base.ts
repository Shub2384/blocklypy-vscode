import * as vscode from 'vscode';
import { getIcon } from './utils';

const PACKAGEJSON_COMMAND_PREFIX = 'BlocklyPy: ';

export interface TreeItemData {
    id?: string;
    command: string;
    title?: string;
    tooltip?: string;
    description?: string;
    icon?: string;
    check?: boolean;
    commandArguments?: any[];
    collapsibleState?: vscode.TreeItemCollapsibleState;
}

export class BaseTreeItem extends vscode.TreeItem {
    constructor(
        label: string,
        id?: string,
        tooltip?: string,
        command?: string,
        icon?: string | { light: string; dark: string },
        context?: vscode.ExtensionContext,
        check?: boolean,
        commandArguments?: any[],
        description?: string,
        collapsibleState: vscode.TreeItemCollapsibleState = vscode
            .TreeItemCollapsibleState.None,
    ) {
        super(label);
        this.id = id;
        this.tooltip = tooltip;
        // this.contextValue = id;
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
        if (icon) {
            this.iconPath = getIcon(icon, context);
        }
        this.description = description;
        this.collapsibleState = collapsibleState;
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
    protected commands: { command?: string; title?: string; icon?: string }[] = [];

    async init(context: vscode.ExtensionContext) {
        this.context = context;
        this.commands = context.extension.packageJSON.contributes.commands;
    }

    getTreeItem(element: T): vscode.TreeItem {
        // read the commands from the extension package.json
        let cmd = {
            ...this.commands?.find((c) => c.command === element.command),
            ...element,
        };
        const title =
            element.title ?? cmd.title?.replace(PACKAGEJSON_COMMAND_PREFIX, '') ?? '';

        return new BaseTreeItem(
            title,
            element.id,
            cmd.tooltip,
            cmd.command,
            cmd.icon,
            this.context,
            cmd.check,
            cmd.commandArguments,
            cmd.description,
            cmd.collapsibleState,
        );
    }
    abstract getChildren(element?: T): vscode.ProviderResult<T[]>;

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    refreshItem(item: T) {
        this._onDidChangeTreeData.fire(item);
    }
}
