import { convertProjectToPython } from 'blocklypy';
import * as vscode from 'vscode';
import { EXTENSION_KEY } from '../const';
import GraphvizLoader from '../utils/graphviz-helper';
import { collectPythonModules } from './collectPythonModules';
import { CustomEditorProviderBase } from './CustomEditorProviderBase';

interface DocumentState {
    document: vscode.CustomDocument;
    content: string | undefined;
    dirty: boolean;
    uriLastModified: number;
    panel: vscode.WebviewPanel | undefined;
}

export class PybricksPythonPreviewProvider
    extends CustomEditorProviderBase<DocumentState>
    implements vscode.CustomReadonlyEditorProvider
{
    public static get Get(): PybricksPythonPreviewProvider | undefined {
        const provider = PybricksPythonPreviewProvider.getProviderByType(
            PybricksPythonPreviewProvider.prototype.constructor as Function,
        );
        return provider as PybricksPythonPreviewProvider | undefined;
    }

    public static get TypeKey() {
        return EXTENSION_KEY + '.pythonPreview';
    }

    /**
     *
     * @param uri Encodes a file URI into a custom URI for the Python preview, adding a "Graph: " prefix to the filename for display
     * @returns The custom URI
     */
    public static encodeUri(uri: vscode.Uri) {
        const filename = uri.path.split('/').pop() || uri.path;
        const customUri = uri.with({
            path: 'Graph: ' + filename,
            fragment: uri.path,
        });
        return customUri;
    }

    /**
     * Decode a custom URI back into a file URI
     * @param uri The custom URI to decode
     * @returns The original file URI
     */
    public static decodeUri(uri: vscode.Uri) {
        return uri.with({
            path: uri.fragment,
            fragment: '',
        });
    }

    protected createDocumentState(document: vscode.CustomDocument): DocumentState {
        return {
            document,
            content: undefined,
            dirty: false,
            uriLastModified: 0,
            panel: undefined,
        };
    }

    protected async refreshWebview(
        document: vscode.CustomDocument,
        webviewPanel: vscode.WebviewPanel,
        _forced = false,
    ) {
        try {
            const state = this.documents.get(document.uri);
            if (!state) return;

            // Collect all modules and generate the dependency graph
            const modules = await collectPythonModules(
                PybricksPythonPreviewProvider.decodeUri(document.uri),
            );
            const encoder = new TextEncoder();
            const files = modules.map((m) => ({
                name: m.path.split('/').pop()!, // Use only the filename
                buffer: encoder.encode(m.content).buffer,
            }));
            const result = await convertProjectToPython(files, {});
            const dependencygraph = result.dependencygraph;
            let content = '';
            if (dependencygraph) {
                const graphviz = await GraphvizLoader();
                content = await graphviz.dot(dependencygraph);
            }

            this.setContent(content, webviewPanel);

            // Set up file change monitoring (re-do every time to catch new imports)
            await this.monitorFileChanges(
                document,
                webviewPanel,
                async () => await this.refreshWebview(document, webviewPanel),
                new Set<string>(modules.map((m) => m.path)),
            );
        } catch (error) {
            console.error('Error in refreshWebview:', error);
        }
    }

    protected async activateWithoutRefresh(
        _document: vscode.CustomDocument,
        _webviewPanel: vscode.WebviewPanel,
    ) {
        // do nothing
    }

    private setContent(content: string, webviewPanel: vscode.WebviewPanel) {
        webviewPanel.webview.postMessage({
            command: 'setContent',
            content,
        });
    }

    protected getHtmlForWebview(webviewPanel: vscode.WebviewPanel): string {
        const scriptUri = this.getScriptUri(webviewPanel);
        // const scriptUri = webviewPanel.webview.asWebviewUri(
        //     vscode.Uri.joinPath(
        //         this.context.extensionUri,
        //         'dist',
        //         'PythonPreviewWebview.js',
        //     ),
        // );
        return `
            <!DOCTYPE html>
            <html>
            <head>
            <meta charset="UTF-8">
            <style>
            html, body, #graph-container {
                height: 100%;
                width: 100%;
                margin: 0;
                padding: 0;
                overflow: hidden;
            }
            #graph-container svg {
                width: 100%;
                height: 100%;
                display: block;
            }
            </style>
            <body>
                <div id="graph-container"></div>
                <script defer src="${scriptUri}"></script>
            </body>
            </html>
        `;
    }
}
