import * as vscode from 'vscode';
import { showError } from './diagnostics';

export function ToCapialized(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

export async function openOrActivate(uri: vscode.Uri) {
    // Check all tab groups for an open tab with the custom URI
    for (const group of vscode.window.tabGroups.all) {
        for (const tab of group.tabs) {
            if (
                tab.input instanceof vscode.TabInputText &&
                tab.input.uri.toString() === uri.toString()
            ) {
                // Activate the tab
                // if (tab.input instanceof vscode.TabInputText) {
                await vscode.window.showTextDocument(tab.input.uri, {
                    preview: false,
                    preserveFocus: false,
                    viewColumn: group.viewColumn,
                });

                return;
            }
        }
    }

    // If not found, open it in a new tab
    await vscode.window.showTextDocument(uri, {
        preview: false,
        preserveFocus: false,
    });
    // await vscode.commands.executeCommand('vscode.open', uri, vscode.ViewColumn.Beside);
}

export function wrapErrorHandling(fn: (...args: any) => Promise<void>) {
    return async (...args: any) => {
        try {
            await fn(...args);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            showError(message);
            console.error(error);
        }
    };
}

type IconPath = { readonly light: vscode.Uri; readonly dark: vscode.Uri };

export function getIcon(
    icon: string | { light: string; dark: string },
    context?: vscode.ExtensionContext,
): string | vscode.ThemeIcon | vscode.Uri | IconPath | undefined {
    if (typeof icon === 'object') {
        return {
            light: getIconInternal(icon.light, context) as vscode.Uri,
            dark: getIconInternal(icon.dark, context) as vscode.Uri,
        };
    } else {
        return getIconInternal(icon, context);
    }
}

function getIconInternal(
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
