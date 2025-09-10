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
