import * as vscode from 'vscode';
import { EXTENSION_KEY } from '../const';

const StatusBarItem = vscode.window.createStatusBarItem(EXTENSION_KEY + '.status');

export function setStatusBarItem(show: boolean, text: string, tooltip: string) {
    StatusBarItem.text = '$(chip) ' + text;
    StatusBarItem.tooltip = tooltip;
    if (show) {
        StatusBarItem.show();
    } else {
        StatusBarItem.hide();
    }
}
