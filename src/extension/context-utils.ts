import * as vscode from 'vscode';
import { ViewType } from '../views/BlocklypyViewerProvider';

export function setContextIsProgramRunning(value: boolean) {
    vscode.commands.executeCommand(
        'setContext',
        'blocklypy-vscode.isProgramRunning',
        value,
    );
}
export function setContextIsConnected(value: boolean) {
    vscode.commands.executeCommand('setContext', 'blocklypy-vscode.isConnected', value);
}
export function setContextCustomViewType(value: ViewType | undefined) {
    vscode.commands.executeCommand(
        'setContext',
        'blocklypy-vscode.customViewType',
        value,
    );
}
