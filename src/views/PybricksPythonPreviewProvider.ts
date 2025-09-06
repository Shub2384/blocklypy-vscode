import { convertProjectToPython } from 'blocklypy';
import * as vscode from 'vscode';
import { EXTENSION_KEY } from '../const';
import { collectPythonModules } from './collectPythonModules';
import { CustomEditorFileWatcherBase } from './CustomEditorFileWatcherBase';
import { GraphvizClass } from './utils';

export class PybricksPythonPreviewProvider
    extends CustomEditorFileWatcherBase
    implements vscode.CustomReadonlyEditorProvider
{
    private static providers = new Map<string, PybricksPythonPreviewProvider>();
    private static activeProvider?: PybricksPythonPreviewProvider;
    private currentPanel?: vscode.WebviewPanel;

    public static get viewType() {
        return EXTENSION_KEY + '.pythonPreview';
    }

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new PybricksPythonPreviewProvider(context);
        return vscode.window.registerCustomEditorProvider(
            PybricksPythonPreviewProvider.viewType,
            provider,
            {
                webviewOptions: { retainContextWhenHidden: true },
                supportsMultipleEditorsPerDocument: false,
            },
        );
    }

    public static getProviderForUri(
        uri: vscode.Uri,
    ): PybricksPythonPreviewProvider | undefined {
        return PybricksPythonPreviewProvider.providers.get(uri.toString());
    }

    public static get activeViewer(): PybricksPythonPreviewProvider | undefined {
        return PybricksPythonPreviewProvider.activeProvider;
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
            scheme: 'blocklypy-preview',
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
        if (uri.scheme !== 'blocklypy-preview') {
            throw new Error('Invalid scheme: ' + uri.scheme);
        }
        return uri.with({
            scheme: 'file',
            path: uri.fragment,
        });
    }

    async openCustomDocument(
        uri: vscode.Uri,
        openContext: { backupId?: string },
        _token: vscode.CancellationToken,
    ): Promise<vscode.CustomDocument> {
        PybricksPythonPreviewProvider.providers.set(uri.toString(), this);
        return {
            uri,
            dispose: () => {
                PybricksPythonPreviewProvider.providers.delete(uri.toString());
            },
        };
    }

    async resolveCustomEditor(
        document: vscode.CustomDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken,
    ): Promise<void> {
        this.currentPanel = webviewPanel;
        PybricksPythonPreviewProvider.activeProvider = this;

        webviewPanel.webview.options = {
            enableScripts: true,
        };

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
            const graphviz = await GraphvizClass();
            content = await graphviz.dot(dependencygraph);
        }

        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel);

        // setTimeout(() => {
        this.refreshWebview(document);
        // });
    }

    public async refreshWebview(document: vscode.CustomDocument) {
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
            const graphviz = await GraphvizClass();
            content = await graphviz.dot(dependencygraph);
        }

        this.setContent(content);

        // Set up file change monitoring (re-do every time to catch new imports)
        await this.monitorFileChanges(
            document,
            this.currentPanel,
            async () => await this.refreshWebview(document),
            new Set<string>(modules.map((m) => m.path)),
        );
    }

    private setContent(content: string) {
        if (PybricksPythonPreviewProvider.activeViewer === this) {
            this.currentPanel?.webview.postMessage({
                command: 'setContent',
                content,
            });
        }
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
}
