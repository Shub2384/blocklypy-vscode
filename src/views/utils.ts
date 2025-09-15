import * as vscode from 'vscode';

export function getScriptUri(
    context: vscode.ExtensionContext,
    webviewContainer: vscode.WebviewPanel | vscode.WebviewView,
    basename: string,
): vscode.Uri {
    return webviewContainer.webview.asWebviewUri(
        vscode.Uri.joinPath(context.extensionUri, 'dist', basename + '.js'),
    );
}
