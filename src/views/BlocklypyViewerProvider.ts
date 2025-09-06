import {
    convertProjectToPython,
    IPyConverterFile,
    IPyConverterOptions,
} from 'blocklypy';
import * as vscode from 'vscode';
import { EXTENSION_KEY } from '../const';
import { CustomEditorFileWatcherBase } from './CustomEditorFileWatcherBase';
import { logDebug } from '../extension/debug-channel';
import {
    setContextContentAvailability,
    setContextCustomViewType,
} from '../extension/context-utils';
import { get } from 'http';
import GraphvizLoader from '../utils/graphviz-helper';

interface BlocklypyViewerContent {
    filename?: string;
    pycode?: string;
    pseudo?: string;
    preview?: string;
    graph?: string;
    // result
}
export type BlocklypyViewerContentAvailabilityMap = Record<
    Exclude<keyof BlocklypyViewerContent, 'filename' | 'result'>,
    boolean
>;

export enum ViewType {
    Preview = 'preview',
    Pseudo = 'pseudo',
    Pycode = 'pycode',
    Graph = 'graph',
    Loading = 'loading',
}

interface DocumentState {
    document: vscode.CustomDocument;
    viewtype: ViewType;
    content: BlocklypyViewerContent | undefined;
    contentAvailability: BlocklypyViewerContentAvailabilityMap | undefined;
    dirty: boolean;
    uriLastModified: number;
    panel: vscode.WebviewPanel | undefined;
}

export class BlocklypyViewerProvider
    extends CustomEditorFileWatcherBase
    implements vscode.CustomReadonlyEditorProvider
{
    private static providerInstance: BlocklypyViewerProvider | undefined = undefined;
    private documents = new Map<vscode.Uri | undefined, DocumentState>();
    private activeUri?: vscode.Uri;

    public static get viewType() {
        return EXTENSION_KEY + '.blocklypyViewer';
    }

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new BlocklypyViewerProvider(context);
        BlocklypyViewerProvider.providerInstance = provider;
        return vscode.window.registerCustomEditorProvider(
            BlocklypyViewerProvider.viewType,
            provider,
            {
                webviewOptions: { retainContextWhenHidden: true },
                supportsMultipleEditorsPerDocument: false,
            },
        );
    }

    public static get Provider(): BlocklypyViewerProvider | undefined {
        return BlocklypyViewerProvider.providerInstance;
    }

    constructor(private readonly context: vscode.ExtensionContext) {
        super();
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

        const state = {
            document,
            viewtype: ViewType.Loading,
            content: undefined,
            contentAvailability: undefined,
            dirty: false,
            uriLastModified: 0,
            panel: undefined,
        } satisfies DocumentState;

        this.documents.set(uri, state);
        this.activeUri = uri;

        return document;
    }

    async resolveCustomEditor(
        document: vscode.CustomDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken,
    ): Promise<void> {
        // find the current state
        this.activeUri = document.uri;

        const state = this.documents.get(document.uri);
        if (!state) throw new Error('No document state found');
        state.panel = webviewPanel;

        webviewPanel.onDidChangeViewState(
            async (e: vscode.WebviewPanelOnDidChangeViewStateEvent) => {
                // find the matching uri and state
                const state = this.documents.get(document.uri);
                if (webviewPanel.active) {
                    this.activeUri = document.uri;
                    if (state?.dirty) {
                        await this.refreshWebview(document, true);
                        // setContextContentAvailability is called in refreshWebview
                    } else {
                        setContextContentAvailability(state?.contentAvailability);
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

            // // Serialize state and store it
            // const state = this.serializeState();
            // this.context.workspaceState.update(
            //     `blocklypyViewerState:${this.currentDocument?.uri.toString()}`,
            //     state,
            // );
        });

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
                await this.refreshWebview(document, true);

                setTimeout(() => {
                    const state = this.documents.get(document.uri);
                    this.showView(this.guardViewType(state, state?.viewtype));
                    logDebug(
                        state?.content
                            ? `Successfully converted ${document.uri.path} to Python (${state.content.pycode?.length} bytes).`
                            : `Failed to convert ${document.uri.path} to Python.`,
                    );
                }, 100);
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
        const state = this.documents.get(document.uri);
        if (!state) return;

        if (this.activeUri === document.uri || forced) {
            state.uriLastModified = (
                await vscode.workspace.fs.stat(document.uri)
            ).mtime;

            state.content = await this.convertFileToPython(document.uri);
            state.contentAvailability = {
                preview: !!state.content.preview,
                pseudo: !!state.content.pseudo,
                pycode: !!state.content.pycode,
                graph: !!state.content.graph,
            } satisfies BlocklypyViewerContentAvailabilityMap;
            setContextContentAvailability(state.contentAvailability);

            this.showView(this.guardViewType(state, state.viewtype));
            state.dirty = false;
        } else {
            state.dirty = true; // Mark as dirty, don't refresh yet
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

        const graphviz = await GraphvizLoader();

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
        const state = this.documents.get(this.activeUri);

        const view = this.guardViewType(
            state,
            this.nextView(state?.viewtype, forward ? +1 : -1),
        );
        this.showView(view);
    }

    private contentForView(
        state: DocumentState | undefined,
        view: ViewType | undefined,
    ) {
        if (view === ViewType.Pycode && state?.content?.pycode) {
            return state.content.pycode;
        } else if (view === ViewType.Pseudo && state?.content?.pseudo) {
            return state.content.pseudo;
        } else if (view === ViewType.Preview && state?.content?.preview) {
            return state.content.preview;
        } else if (view === ViewType.Graph && state?.content?.graph) {
            return state.content.graph;
        } else {
            return undefined;
        }
    }

    private guardViewType(
        state: DocumentState | undefined,
        current: ViewType | undefined,
    ): ViewType {
        let effectiveView = current;
        let content: string | undefined;
        do {
            content = this.contentForView(state, effectiveView);
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
        const state = this.documents.get(this.activeUri);
        if (!state) throw new Error('No active document state');

        const content = view ? this.contentForView(state, view) : undefined;
        state.viewtype = view ?? ViewType.Loading;
        setContextCustomViewType(view);

        state.panel?.webview.postMessage({
            command: 'showView',
            view: state.viewtype,
            content,
        });
    }

    private getHtmlForWebview(webviewPanel: vscode.WebviewPanel): string {
        const state = this.documents.get(this.activeUri);
        if (!state) throw new Error('No active document state');

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
        // const languageWorkerUris = ['python', 'less'].map((lang) => [
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
            <title>${state.content?.filename}</title>
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
        const state = this.documents.get(this.activeUri);
        return state?.content?.pycode;
    }

    get filename(): string | undefined {
        const state = this.documents.get(this.activeUri);
        return state?.content?.filename;
    }

    // public serializeState(): any {
    //     if (!this.currentDocument?.uri) {
    //         return undefined;
    //     }

    //     return {
    //         uri: this.currentDocument?.uri.toString(),
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
