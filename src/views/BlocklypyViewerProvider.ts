import {
    convertProjectToPython,
    IPyConverterFile,
    IPyConverterOptions,
} from 'blocklypy';
import path from 'path';
import * as vscode from 'vscode';
import { checkExtraFilesForConversion } from '../blocklypy/collectfiles';
import { EXTENSION_KEY } from '../const';
import {
    setContextContentAvailability,
    setContextCustomViewType,
} from '../extension/context-utils';
import { logDebug } from '../extension/debug-channel';
import GraphvizLoader from '../utils/graphviz-helper';
import { CustomEditorProviderBase } from './CustomEditorProviderBase';

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

export class BlocklypyViewer {
    constructor(
        public document: vscode.CustomDocument,
        public viewtype: ViewType,
        public content: BlocklypyViewerContent | undefined,
        public contentAvailability: BlocklypyViewerContentAvailabilityMap | undefined,
        public dirty: boolean,
        public uriLastModified: number,
        public panel: vscode.WebviewPanel | undefined,
        public provider: BlocklypyViewerProvider,
    ) {}
    public setErrorLine(line: number, message: string) {
        if (this.viewtype !== ViewType.Pycode) {
            this.provider.showView(ViewType.Pycode);
            this.panel?.webview.postMessage({
                command: 'setErrorLine',
                line,
                message,
            });
        }
    }
}

export class BlocklypyViewerProvider
    extends CustomEditorProviderBase<BlocklypyViewer>
    implements vscode.CustomReadonlyEditorProvider
{
    public static get Get(): BlocklypyViewerProvider | undefined {
        const provider = BlocklypyViewerProvider.getProviderByType(
            BlocklypyViewerProvider.prototype.constructor as Function,
        );
        return provider as BlocklypyViewerProvider | undefined;
    }

    public static get TypeKey() {
        return EXTENSION_KEY + '.blocklypyViewer';
    }

    public static get activeBlocklypyViewer(): BlocklypyViewer | undefined {
        const provider = BlocklypyViewerProvider.Get;
        return provider?.documents.get(provider.activeUri);
    }

    constructor(context: vscode.ExtensionContext) {
        super(context);
        vscode.languages.onDidChangeDiagnostics(this.handleDiagnosticsChange, this);
    }

    protected createDocumentState(document: vscode.CustomDocument): BlocklypyViewer {
        return new BlocklypyViewer(
            document,
            ViewType.Loading,
            undefined,
            undefined,
            false,
            0,
            undefined,
            this,
        );
    }

    async resolveCustomEditor(
        document: vscode.CustomDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken,
    ): Promise<void> {
        await super.resolveCustomEditor(document, webviewPanel, _token);

        // refresh of data is done in refreshWebview super.resolveCustomEditor
        const state = this.documents.get(document.uri);
        this.showView(this.guardViewType(state, state?.viewtype));
        const filename = path.basename(document.uri.path);
        logDebug(
            state?.content
                ? `Successfully converted ${filename} to Python (${state.content.pycode?.length} bytes).`
                : `Failed to convert ${filename} to Python.`,
        );

        // Set up file change monitoring
        await this.monitorFileChanges(
            document,
            webviewPanel,
            async () => await this.refreshWebview(document, webviewPanel),
            undefined, // or pass a Set<string> of watched URIs if needed
        );
    }

    protected async refreshWebview(
        document: vscode.CustomDocument,
        _webviewPanel: vscode.WebviewPanel,
        forced = false,
    ) {
        try {
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
        } catch (error) {
            console.error('Error in refreshWebview:', error);
        }
    }

    protected activateWithoutRefresh(
        _document: vscode.CustomDocument,
        _webviewPanel: vscode.WebviewPanel,
    ): Promise<void> {
        const state = this.documents.get(this.activeUri);
        if (!state) return Promise.resolve();

        setContextContentAvailability(state.contentAvailability);
        return Promise.resolve();
    }

    private async convertFileToPython(uri: vscode.Uri) {
        const fileUint8Array = await vscode.workspace.fs.readFile(uri);

        const file: IPyConverterFile = {
            name: uri.path.split('/').pop() || 'project',
            buffer: fileUint8Array.buffer as ArrayBuffer,
        };

        // collect additional extra files, such as image for .proj file followig the wedo 2.0 app approach <filewithoutextension\LobbyPreview.jpg>
        const allFiles = await checkExtraFilesForConversion(uri, file);

        const options = {
            output: { 'blockly.svg': true, 'wedo2.preview': true },
            debug: {
                showExplainingComments: true,
            },
            log: {
                callback: (level, ...args: unknown[]) => {
                    const line = Array.isArray(args) ? args.join(' ') : String(args);
                    logDebug(line);
                },
            },
        } satisfies IPyConverterOptions;

        const result = await convertProjectToPython(allFiles, options);
        const filename = Array.isArray(result.name)
            ? result.name.join(', ')
            : result.name || 'Unknown';

        const pycode: string | undefined = Array.isArray(result.pycode)
            ? result.pycode.join('\n')
            : result.pycode;

        const pseudo: string | undefined = result.plaincode;

        const preview: string | undefined =
            result.extra?.['blockly.svg'] || result.extra?.['wedo2.preview'];

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
        state: BlocklypyViewer | undefined,
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
        state: BlocklypyViewer | undefined,
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

    private handleDiagnosticsChange() {
        const state = this.documents.get(this.activeUri);
        // NOTE: We might get a URI that does not match the current activeUri
        // in case of multiple open editors with different files.
        // We would need to find the correct state for that URI and activate it.
        // However, as LEGO files do not reference external ones (everything is __main__.py),
        // this is not needed.
        if (!state || !state.panel) return;

        const diagnostics = vscode.languages.getDiagnostics(state.document.uri);
        if (diagnostics.length > 0) {
            const firstError = diagnostics.find(
                (d) => d.severity === vscode.DiagnosticSeverity.Error,
            );
            if (firstError) {
                state.setErrorLine(firstError.range.start.line, firstError.message);
            }
        }
    }

    protected getHtmlForWebview(webviewPanel: vscode.WebviewPanel): string {
        const state = this.documents.get(this.activeUri);
        if (!state) throw new Error('No active document state');

        const scriptUri = this.getScriptUri(webviewPanel, 'BlocklypyWebview');
        // const scriptUri = webviewPanel.webview.asWebviewUri(
        //     vscode.Uri.joinPath(
        //         this.context.extensionUri,
        //         'dist',
        //         'webviews.js',
        //     ),
        // );
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
            #preview svg, #preview img, #graph svg {
                width: 100%;
                height: 100%;
                display: block;
            }
            #preview img {
                object-fit: contain;
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
}
