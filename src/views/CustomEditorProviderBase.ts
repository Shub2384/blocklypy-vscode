import * as vscode from 'vscode';
import { CustomEditorFileWatcherBase } from './CustomEditorFileWatcherBase';

interface DocumentState {
    document: vscode.CustomDocument;
    panel?: vscode.WebviewPanel;
    dirty: boolean;
    uriLastModified: number;
}

export abstract class CustomEditorProviderBase<TState extends DocumentState>
    extends CustomEditorFileWatcherBase
    implements vscode.CustomReadonlyEditorProvider
{
    private static providerByType = new Map<
        Function,
        CustomEditorProviderBase<DocumentState>
    >();
    protected documents = new Map<vscode.Uri | undefined, TState>();
    protected activeUri?: vscode.Uri;

    constructor(protected readonly context: vscode.ExtensionContext) {
        super();

        const providerType = this.constructor as new (
            context: vscode.ExtensionContext,
        ) => CustomEditorProviderBase<DocumentState>;
        CustomEditorProviderBase.providerByType.set(providerType, this);
    }

    public static register(
        context: vscode.ExtensionContext,
        providerCreator: new (
            context: vscode.ExtensionContext,
        ) => CustomEditorProviderBase<DocumentState>,
        providerKey: string,
    ): vscode.Disposable {
        const provider = new providerCreator(context);
        return vscode.window.registerCustomEditorProvider(providerKey, provider, {
            webviewOptions: { retainContextWhenHidden: true },
            supportsMultipleEditorsPerDocument: false,
        });
    }

    public static getProviderByType(
        providerType: Function,
    ): CustomEditorProviderBase<DocumentState> | undefined {
        return this.providerByType.get(providerType);
    }

    async openCustomDocument(
        uri: vscode.Uri,
        openContext: { backupId?: string },
        _token: vscode.CancellationToken,
    ): Promise<vscode.CustomDocument> {
        const document: vscode.CustomDocument = {
            uri,
            dispose: () => {
                this.documents.delete(uri);
                if (this.activeUri === uri) {
                    this.activeUri = undefined;
                }
            },
        };

        const state = this.createDocumentState(document);
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
            async (e: vscode.WebviewPanelOnDidChangeViewStateEvent) => {
                const state = this.documents.get(document.uri);
                if (webviewPanel.active) {
                    this.activeUri = document.uri;
                    if (state?.dirty) {
                        await this.refreshWebview(document, webviewPanel, true);
                        // setContextContentAvailability is called in refreshWebview
                    } else {
                        await this.activateWithoutRefresh(document, webviewPanel);
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

        webviewPanel.webview.options = { enableScripts: true };
        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel);

        await this.refreshWebview(document, webviewPanel, true);
    }

    protected abstract createDocumentState(document: vscode.CustomDocument): TState;
    protected abstract getHtmlForWebview(webviewPanel: vscode.WebviewPanel): string;
    protected abstract refreshWebview(
        document: vscode.CustomDocument,
        webviewPanel: vscode.WebviewPanel,
        forced?: boolean,
    ): Promise<void>;
    protected abstract activateWithoutRefresh(
        document: vscode.CustomDocument,
        webviewPanel: vscode.WebviewPanel,
    ): Promise<void>;

    public get ActiveUri(): vscode.Uri | undefined {
        return this.activeUri;
    }

    protected disposeAll() {
        for (const state of this.documents.values()) {
            state.panel?.dispose();
        }
        this.documents.clear();
    }
}
