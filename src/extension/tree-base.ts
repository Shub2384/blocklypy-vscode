import * as vscode from 'vscode';

const PACKAGEJSON_COMMAND_PREFIX = 'BlocklyPy: ';

export interface TreeItemData {
    command: string;
    title?: string;
    icon?: string;
    check?: boolean;
    commandArguments?: any[];
}

export class BaseTreeItem extends vscode.TreeItem {
    constructor(
        title: string,
        label: string,
        command: string,
        icon: string | { light: string; dark: string },
        context?: vscode.ExtensionContext,
        checkboxState?: vscode.TreeItemCheckboxState,
        commandArguments?: any[],
    ) {
        super(label);
        if (checkboxState !== undefined) {
            this.checkboxState = checkboxState;
        }
        if (command) {
            this.command = {
                command,
                title,
                arguments: commandArguments,
            } as vscode.Command;
        }
        if (icon) {
            this.processIcon(icon, context);
        }
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

    private itemMap = new Map<string, T>();
    async init(context: vscode.ExtensionContext) {
        this.context = context;
        this.commands = context.extension.packageJSON.contributes.commands;
        // this.refresh();
    }

    getTreeItem(element: T): vscode.TreeItem {
        let cmd = {
            ...this.commands?.find((c) => c.command === element.command),
            ...element,
        };
        const title =
            element.title ?? cmd.title?.replace(PACKAGEJSON_COMMAND_PREFIX, '') ?? '';
        const icon = element.icon ?? cmd.icon ?? '';

        return new BaseTreeItem(
            title,
            title,
            element.command ?? '',
            icon,
            this.context,
            element.check === undefined
                ? undefined
                : element.check
                ? vscode.TreeItemCheckboxState.Checked
                : vscode.TreeItemCheckboxState.Unchecked,
            element.commandArguments,
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
