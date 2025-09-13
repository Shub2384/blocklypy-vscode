import os from 'os';
import path from 'path';
import * as vscode from 'vscode';

export function getActiveFileFolder(): string | undefined {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspaceFolder) return workspaceFolder;

    const activeFile = vscode.window.activeTextEditor?.document.uri.fsPath;
    if (activeFile) return path.dirname(activeFile);

    return os.tmpdir();
}
