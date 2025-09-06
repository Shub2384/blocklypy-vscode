import * as vscode from 'vscode';

const DebugChannel = vscode.window.createOutputChannel('BlocklyPy Pybricks Debug');

export function clearDebugLog() {
    DebugChannel.clear();
}

export function logDebug(
    message: string,
    { linebreak, show }: { linebreak?: boolean; show?: boolean } = {},
) {
    if (linebreak !== false) {
        DebugChannel.appendLine(message);
    } else {
        DebugChannel.append(message);
    }

    if (show !== false) {
        DebugChannel.show(true);
    }
}
