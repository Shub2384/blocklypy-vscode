// TODO: themeing
// TODO: import { default as uPlot } from 'uplot'; // import 'uplot/dist/uPlot.min.css';

import * as vscode from 'vscode';
import { EXTENSION_KEY } from '../const';
import { setContextPlotDataAvailability } from '../extension/context-utils';
import { plotManager } from '../logic/stdout-helper';
import { getScriptUri } from './utils';

export class DatalogView implements vscode.WebviewViewProvider {
    public static readonly viewType = EXTENSION_KEY + '-datalogview';
    private static _instance: DatalogView | undefined;

    private readonly context: vscode.ExtensionContext;
    private currentWebviewView: vscode.WebviewView | undefined;

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    // Better static accessor with proper naming
    public static get Instance(): DatalogView | undefined {
        return DatalogView._instance;
    }

    public static register(context: vscode.ExtensionContext): DatalogView {
        const provider = new DatalogView(context);
        DatalogView._instance = provider; // Save instance

        const reg = vscode.window.registerWebviewViewProvider(
            DatalogView.viewType,
            provider,
            { webviewOptions: { retainContextWhenHidden: true } },
        );
        context.subscriptions.push(reg);
        return provider;
    }

    public async resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ): Promise<void> {
        this.currentWebviewView = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, 'dist'),
                // vscode.Uri.joinPath(
                //     this.context.extensionUri,
                //     'node_modules',
                //     'uplot',
                //     'dist',
                // ),
            ],
        };

        // get classname from DatalogView
        const scriptUri = getScriptUri(this.context, webviewView, 'DatalogWebview');
        webviewView.webview.html = this.getHtmlForWebview(scriptUri);

        // Initialize the from the webview with the last header data
        setTimeout(async () => {
            if (!plotManager) return;
            await this.setHeaders(plotManager.datalogcolumns, plotManager.data);
        }, 100);
    }

    public async setHeaders(cols: string[], rows?: number[][]) {
        await setContextPlotDataAvailability(true);

        await focusChartView();

        await this.currentWebviewView?.webview.postMessage({
            command: 'setHeaders',
            payload: { cols, rows },
        });
    }

    public async addData(row: number[]) {
        await this.currentWebviewView?.webview.postMessage({
            command: 'addData',
            payload: row,
        });
    }

    private getHtmlForWebview(scriptSrc: vscode.Uri): string {
        return /* html */ `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8" />
                <meta http-equiv="Content-Security-Policy"
                        content="default-src 'none'; style-src 'self' 'unsafe-inline'; script-src * 'unsafe-inline' 'unsafe-eval';"/>
                <style>
                    html, body, #chart-container {
                        height: 100%;
                        width: 100%;
                        margin: 0;
                        padding: 0;
                        overflow: hidden;
                    }
                </style>
            </head>
            <body>
                <div id="chart-container"></div>
                <script src="${scriptSrc}"></script>
            </body>
            </html>
        `;
    }
}

// To focus the chart view programmatically:
async function focusChartView() {
    // First open the panel (if not already open & focus)
    await vscode.commands.executeCommand('workbench.action.focusPanel');

    // Then focus the specific view container
    await vscode.commands.executeCommand(
        'workbench.view.extension.blocklypy-vscode-datalogview-panel',
    );
}
