import * as vscode from 'vscode';

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
            this.processIcon(icon, context);
        }
        this.description = description;
        this.collapsibleState = collapsibleState;
    }

    processIcon(
        icon: string | { light: string; dark: string },
        context?: vscode.ExtensionContext,
    ) {
        if (typeof icon === 'object') {
            this.iconPath = {
                light: this.processIcon1(icon.light, context) as vscode.Uri,
                dark: this.processIcon1(icon.dark, context) as vscode.Uri,
            };
        } else {
            this.iconPath = this.processIcon1(icon, context);
        }
    }

    private processIcon1(
        icon: string,
        context?: vscode.ExtensionContext,
    ): string | vscode.ThemeIcon | vscode.Uri | undefined {
        if ((icon.endsWith('.svg') || icon.endsWith('.png')) && context) {
            const iconPath = context.asAbsolutePath(icon);
            return vscode.Uri.file(iconPath);
        } else if (icon.startsWith('$(') && icon.endsWith(')')) {
            const iconName = icon.slice(2, -1);
            return new vscode.ThemeIcon(iconName);
        } else {
            return new vscode.ThemeIcon(icon);
        }
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
