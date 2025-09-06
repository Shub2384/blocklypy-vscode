import { convertProjectToPython } from 'blocklypy';
import * as vscode from 'vscode';
import { EXTENSION_KEY } from '../const';
import { collectPythonModules } from './collectPythonModules';
import { CustomEditorFileWatcherBase } from './CustomEditorFileWatcherBase';
import GraphvizLoader from '../utils/graphviz-helper';

interface DocumentState {
    document: vscode.CustomDocument;
    content: string | undefined;
    dirty: boolean;
    uriLastModified: number;
    panel: vscode.WebviewPanel | undefined;
}

export class PybricksPythonPreviewProvider
    extends CustomEditorFileWatcherBase
    implements vscode.CustomReadonlyEditorProvider
{
    private static providerInstance: PybricksPythonPreviewProvider | undefined =
        undefined;
    private documents = new Map<vscode.Uri | undefined, DocumentState>();
    private activeUri?: vscode.Uri;

    public static get viewType() {
        return EXTENSION_KEY + '.pythonPreview';
    }

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new PybricksPythonPreviewProvider(context);
        PybricksPythonPreviewProvider.providerInstance = provider;
        return vscode.window.registerCustomEditorProvider(
            PybricksPythonPreviewProvider.viewType,
            provider,
            {
                webviewOptions: { retainContextWhenHidden: true },
                supportsMultipleEditorsPerDocument: false,
            },
        );
    }

    public static get Get(): PybricksPythonPreviewProvider | undefined {
        return PybricksPythonPreviewProvider.providerInstance;
    }

    constructor(private readonly context: vscode.ExtensionContext) {
        super();
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

    async openCustomDocument(
        uri: vscode.Uri,
        openContext: { backupId?: string },
        _token: vscode.CancellationToken,
    ): Promise<vscode.CustomDocument> {
        const document = {
            uri,
            dispose: () => {
                this.documents.delete(uri);
                if (this.activeUri === uri) {
                    this.activeUri = undefined;
                }
            },
        };

        const state: DocumentState = {
            document,
            content: undefined,
            dirty: false,
            uriLastModified: 0,
            panel: undefined,
        };
        this.documents.set(uri, state);
        this.activeUri = uri;

        return document;
    }

    async resolveCustomEditor(
        document: vscode.CustomDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken,
    ): Promise<void> {
        this.activeUri = document.uri;

        const state = this.documents.get(document.uri);
        if (!state) throw new Error('Document state not found');
        state.panel = webviewPanel;

        webviewPanel.onDidChangeViewState(
            (e: vscode.WebviewPanelOnDidChangeViewStateEvent) => {
                // find the matching uri and state
                const state = this.documents.get(document.uri);
                if (webviewPanel.active) {
                    this.activeUri = document.uri;
                    if (state?.dirty) {
                        this.refreshWebview(document, webviewPanel, true);
                    }
                } else if (this.activeUri === document.uri) {
                    this.activeUri = undefined;
                }
            },
        );

        webviewPanel.onDidDispose(() => {
            this.documents.delete(document.uri);
            if (this.activeUri === document.uri) {
                this.activeUri = undefined;
            }
        });

        webviewPanel.webview.options = {
            enableScripts: true,
        };

        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel);

        // setTimeout(() => {
        this.refreshWebview(document, webviewPanel);
        // });
    }

    public async refreshWebview(
        document: vscode.CustomDocument,
        webviewPanel: vscode.WebviewPanel,
        _forced = false,
    ) {
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
    }

    private setContent(content: string, webviewPanel: vscode.WebviewPanel) {
        webviewPanel.webview.postMessage({
            command: 'setContent',
            content,
        });
    }

    private getHtmlForWebview(webviewPanel: vscode.WebviewPanel): string {
        const scriptUri = webviewPanel.webview.asWebviewUri(
            vscode.Uri.joinPath(
                this.context.extensionUri,
                'dist',
                'PythonPreviewWebview.js',
            ),
        );
        return `
            <!DOCTYPE html>
            <html>
            <head>
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

    public get ActiveUri(): vscode.Uri | undefined {
        return this?.activeUri;
    }
}
