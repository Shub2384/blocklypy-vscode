import * as vscode from 'vscode';

const PACKAGEJSON_COMMAND_PREFIX = 'BlocklyPy: ';

export interface ITreeItem {
    command: string;
    title?: string;
    icon?: string;
    check?: boolean;
}

export class BaseTreeItem extends vscode.TreeItem {
    constructor(
        title: string,
        label: string,
        command: string,
        icon: string,
        collapsibleState: vscode.TreeItemCollapsibleState = vscode
            .TreeItemCollapsibleState.None,
        context?: vscode.ExtensionContext,
        checkboxState?: vscode.TreeItemCheckboxState,
    ) {
        super(label, collapsibleState);
        if (checkboxState !== undefined) {
            this.checkboxState = checkboxState;
        }
        if (command) {
            this.command = {
                command: command,
                title: title,
            };
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

export abstract class BaseTreeDataProvider<T extends BaseTreeItem>
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
        this.refresh();
    }

    getTreeItem(element: T): T {
        return element;
    }
    abstract getChildren(element?: T): vscode.ProviderResult<T[]>;

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    protected expandChildren(elems: ITreeItem[]) {
        const elems2 = [] as BaseTreeItem[];
        for (const e of elems) {
            let cmd = { ...this.commands?.find((c) => c.command === e.command), ...e };
            cmd.title = cmd.title?.replace(PACKAGEJSON_COMMAND_PREFIX, '') ?? '';

            const elem = new BaseTreeItem(
                cmd.title ?? '',
                cmd.title ?? '',
                cmd.command ?? '',
                cmd.icon ?? '',
                vscode.TreeItemCollapsibleState.None,
                this.context,
                e.check === undefined
                    ? undefined
                    : e.check
                    ? vscode.TreeItemCheckboxState.Checked
                    : vscode.TreeItemCheckboxState.Unchecked,
            );
            elems2.push(elem);
        }
        return elems2;
    }
}
