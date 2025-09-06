import {
    convertProjectToPython,
    IPyConverterFile,
    IPyConverterOptions,
} from 'blocklypy';
import * as vscode from 'vscode';
import { logDebug, setContextCustomViewType } from '../extension';
import { GraphvizClass } from './utils';
import { CustomEditorFileWatcherBase } from './CustomEditorFileWatcherBase';

interface BlocklypyViewerContent {
    filename?: string;
    pycode?: string;
    pseudo?: string;
    preview?: string;
    graph?: string;
    // result
}

// interface BlocklypyViewerState {
//     uri: string;
//     currentView?: ViewType;
//     content: BlocklypyViewerContent;
//     lastModified: number;
// }

export enum ViewType {
    Preview = 'preview',
    Pseudo = 'pseudo',
    Pycode = 'pycode',
    Graph = 'graph',
    Loading = 'loading',
}

export class BlocklypyViewerProvider
    extends CustomEditorFileWatcherBase
    implements vscode.CustomReadonlyEditorProvider
{
    private static providers = new Map<string, BlocklypyViewerProvider>();
    private static activeProvider?: BlocklypyViewerProvider;

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new BlocklypyViewerProvider(context);
        return vscode.window.registerCustomEditorProvider(
            'pybricks.blocklypyViewer',
            provider,
            {
                webviewOptions: { retainContextWhenHidden: true },
                supportsMultipleEditorsPerDocument: false,
            },
        );
    }

    public static getProviderForUri(
        uri: vscode.Uri,
    ): BlocklypyViewerProvider | undefined {
        return BlocklypyViewerProvider.providers.get(uri.toString());
    }

    public static get activeViewer(): BlocklypyViewerProvider | undefined {
        return BlocklypyViewerProvider.activeProvider;
    }

    constructor(private readonly context: vscode.ExtensionContext) {
        super();
    }

    private content: BlocklypyViewerContent = {};
    private currentPanel?: vscode.WebviewPanel;
    private currentView?: ViewType;
    private dirty = false;

    async openCustomDocument(
        uri: vscode.Uri,
        openContext: { backupId?: string },
        _token: vscode.CancellationToken,
    ): Promise<vscode.CustomDocument> {
        BlocklypyViewerProvider.providers.set(uri.toString(), this);
        return {
            uri,
            dispose: () => {
                BlocklypyViewerProvider.providers.delete(uri.toString());
            },
        };
    }

    async resolveCustomEditor(
        document: vscode.CustomDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken,
    ): Promise<void> {
        this.currentPanel = webviewPanel;
        BlocklypyViewerProvider.activeProvider = this;

        webviewPanel.onDidChangeViewState(
            (e: vscode.WebviewPanelOnDidChangeViewStateEvent) => {
                if (webviewPanel.active) {
                    BlocklypyViewerProvider.activeProvider = this;
                    if (this.dirty) {
                        this.refreshWebview(document, true);
                    }
                } else if (BlocklypyViewerProvider.activeProvider === this) {
                    BlocklypyViewerProvider.activeProvider = undefined;
                }
            },
        );

        // webviewPanel.onDidDispose(() => {
        //     // Serialize state and store it
        //     const state = this.serializeState();
        //     this.context.workspaceState.update(
        //         `blocklypyViewerState:${this.uri?.toString()}`,
        //         state,
        //     );
        // });

        webviewPanel.webview.options = {
            enableScripts: true,
        };

        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel);
        // this.showView(undefined);

        // const fileStat = await vscode.workspace.fs.stat(document.uri);
        // this.uriLastModified = fileStat.mtime;

        // Try to restore state from workspace storage
        // const storedState = (await this.context.workspaceState.get(
        //     `blocklypyViewerState:${document.uri.toString()}`,
        // )) as BlocklypyViewerState | undefined;
        // if (storedState && storedState.lastModified === this.uriLastModified) {
        //     this.restoreState(storedState);
        //     webviewPanel.webview.html = this.getHtmlForWebview();
        //     setTimeout(() => {
        //         this.showView(this.availableView(this.currentView));
        //     }, 100);
        //     logDebug(`Restored state for ${document.uri.path}.`);
        //     return;
        // } else
        {
            setTimeout(async () => {
                // Read the binary file as Uint8Array
                this.content = await this.convertFileToPython(document.uri);

                setTimeout(() => {
                    this.showView(this.availableView(this.currentView));
                }, 100);
                logDebug(
                    this.content
                        ? `Successfully converted ${document.uri.path} to Python (${this.content.pycode?.length} bytes).`
                        : `Failed to convert ${document.uri.path} to Python.`,
                );
            }, 0);
        }

        // Set up file change monitoring
        await this.monitorFileChanges(
            document,
            webviewPanel,
            async () => await this.refreshWebview(document),
            undefined, // or pass a Set<string> of watched URIs if needed
        );
    }

    public async refreshWebview(document: vscode.CustomDocument, forced = false) {
        if (this.currentPanel?.active || forced) {
            this.content = await this.convertFileToPython(document.uri);
            this.showView(this.availableView(this.currentView));
            this.dirty = false;
        } else {
            this.dirty = true; // Mark as dirty, don't refresh yet
        }
    }

    private async convertFileToPython(uri: vscode.Uri) {
        const fileUint8Array = await vscode.workspace.fs.readFile(uri);

        const file: IPyConverterFile = {
            name: uri.path.split('/').pop() || 'project',
            buffer: fileUint8Array.buffer as ArrayBuffer,
        };
        const options = {
            output: { 'blockly.svg': true },
        } satisfies IPyConverterOptions;
        const result = await convertProjectToPython([file], options);
        const filename = Array.isArray(result.name)
            ? result.name.join(', ')
            : result.name || 'Unknown';

        const pycode: string | undefined = Array.isArray(result.pycode)
            ? result.pycode.join('\n')
            : result.pycode;

        const pseudo: string | undefined = result.plaincode;

        const preview: string | undefined = result.extra?.['blockly.svg'];

        const graphviz = await GraphvizClass();
        const dependencygraph = result.dependencygraph;
        const graph: string | undefined = dependencygraph
            ? await graphviz.dot(dependencygraph)
            : undefined;

        const content = {
            filename,
            pycode,
            pseudo,
            preview,
            graph,
        };
        return content;
    }

    public rotateViews(forward: boolean) {
        const view = this.availableView(
            this.nextView(this.currentView, forward ? +1 : -1),
        );
        this.showView(view);
    }

    private contentForView(view: ViewType | undefined) {
        if (view === ViewType.Pycode && this.content.pycode) {
            return this.content.pycode;
        } else if (view === ViewType.Pseudo && this.content.pseudo) {
            return this.content.pseudo;
        } else if (view === ViewType.Preview && this.content.preview) {
            return this.content.preview;
        } else if (view === ViewType.Graph && this.content.graph) {
            return this.content.graph;
        } else {
            return undefined;
        }
    }

    private availableView(current: ViewType | undefined): ViewType {
        let effectiveView = current;
        let content: string | undefined;
        do {
            content = this.contentForView(effectiveView);
            if (!content) {
                // try next view
                effectiveView = this.nextView(effectiveView);
            }
        } while (!content && effectiveView !== current);

        return effectiveView ?? ViewType.Preview;
    }

    private nextView(view: ViewType | undefined, step: number = +1): ViewType {
        const Views = [
            ViewType.Preview,
            ViewType.Pseudo,
            ViewType.Pycode,
            ViewType.Graph,
        ];
        const currentIndex = view ? Views.indexOf(view) : -1;
        const nextIndex = (currentIndex + step + Views.length) % Views.length;
        return Views[nextIndex];
    }

    public showView(view: ViewType | undefined) {
        const content = view ? this.contentForView(view) : undefined;
        this.currentView = view ?? ViewType.Loading;
        setContextCustomViewType(view);

        this.currentPanel?.webview.postMessage({
            command: 'showView',
            view: this.currentView,
            content,
        });
    }

    private getHtmlForWebview(webviewPanel: vscode.WebviewPanel): string {
        const scriptUri = webviewPanel.webview.asWebviewUri(
            vscode.Uri.joinPath(
                this.context.extensionUri,
                'dist',
                'BlocklypyWebview.js',
            ),
        );
        const imageUri = webviewPanel.webview.asWebviewUri(
            vscode.Uri.joinPath(
                this.context.extensionUri,
                'asset',
                'logo-small-spin.svg',
            ),
        );
        const editorWorkerUri = webviewPanel.webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'editor.worker.js'),
        );
        // const languageWorkerUris = ['python', 'vb'].map((lang) => [
        //     lang,
        //     this.currentPanel?.webview.asWebviewUri(
        //         vscode.Uri.joinPath(
        //             this.context.extensionUri,
        //             'dist',
        //             `${lang}.worker.js`,
        //         ),
        //     ),
        // ]);
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
            <meta charset="UTF-8">
            <title>${this.content?.filename}</title>
            <link rel="preload" href="${imageUri}" as="image">
            <style>
            html, body, #container, #editor {
                height: 100%;
                width: 100%;
                margin: 0;
                padding: 0;
                overflow: hidden;
            }
            #container {
                display: flex;
                height: 100vh;
                width: 100vw;
                justify-content: center;
                align-items: center;
            }
            #pycode, #pseudo, #preview, #graph {
                flex: 1 1 auto;
                height: 100%;
                width: 100%;
                display: none;
                overflow: auto;
            }
            #preview, #graph {
                padding: 20px;
            }
            #preview svg, #graph svg {
                width: 100%;
                height: 100%;
                display: block;
            }
            #loading {
                height: 50%;
                width: 50%;
            }
            </style>
            </head>
            <body>
            <div id="container">
                <img id="loading" src="${imageUri}"/>
                <div id="editor" style="display:none"></div>
                <div id="preview" style="display:none"></div>
                <div id="graph" style="display:none"></div>
            </div>

            <script>
            window.workerUrls = {
                'editorWorkerService': '${editorWorkerUri}'
            };
            </script>
            <script deferred src="${scriptUri}"></script>

            </body>
            </html>
        `;
    }

    get pycode(): string | undefined {
        return this.content.pycode;
    }

    get filename(): string | undefined {
        return this.content.filename;
    }

    // public serializeState(): any {
    //     if (!this.uri) {
    //         return undefined;
    //     }

    //     return {
    //         uri: this.uri.toString(),
    //         currentView: this.currentView,
    //         content: this.content,
    //         lastModified: this.uriLastModified,
    //     } satisfies BlocklypyViewerState;
    // }

    // public restoreState(state: BlocklypyViewerState) {
    //     if (state) {
    //         this.currentView = state.currentView;
    //         this.content = state.content;
    //         this.showView(this.currentView);
    //     }
    // }
}
