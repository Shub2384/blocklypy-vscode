import * as vscode from 'vscode';
import { compileAndRunAsync } from './commands/compile-and-run';
import {
    connectDeviceAsync,
    connectDeviceByNameAsync,
} from './commands/connect-device';
import { disconnectDeviceAsync } from './commands/disconnect-device';
import { startUserProgramAsync } from './commands/start-user-program';
import { stopUserProgramAsync } from './commands/stop-user-program';
import { EXTENSION_KEY, MAGIC_AUTOSTART } from './const';
import { Commands } from './extension/commands';
import { registerCommandsTree } from './extension/tree-commands';
import { registerSettingsTree, settingsTreeData } from './extension/tree-settings';
import { MAIN_MOCULE_PATH } from './logic/compile';
import { BlocklypyViewerProvider, ViewType } from './views/BlocklypyViewerProvider';
import { PybricksPythonPreviewProvider } from './views/PybricksPythonPreviewProvider';
import Config from './utils/config';

const DebugChannel = vscode.window.createOutputChannel('BlocklyPy Pybricks Debug');
const diagnosticsCollection =
    vscode.languages.createDiagnosticCollection('BlocklyPy Pybricks');
const statusBarItem = vscode.window.createStatusBarItem(EXTENSION_KEY + '.status');

function wrapErrorHandling(fn: () => Promise<void>) {
    return async () => {
        try {
            await fn();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            showError(message);
            console.error(error);
        }
    };
}

export function setStatusBarItem(show: boolean, text: string, tooltip: string) {
    statusBarItem.text = '$(chip) ' + text;
    statusBarItem.tooltip = tooltip;
    if (show) {
        statusBarItem.show();
    } else {
        statusBarItem.hide();
    }
}

export function setContextIsProgramRunning(value: boolean) {
    vscode.commands.executeCommand(
        'setContext',
        'blocklypy-vscode.isProgramRunning',
        value,
    );
}
export function setContextIsConnected(value: boolean) {
    vscode.commands.executeCommand('setContext', 'blocklypy-vscode.isConnected', value);
}
export function setContextCustomViewType(value: ViewType | undefined) {
    vscode.commands.executeCommand(
        'setContext',
        'blocklypy-vscode.customViewType',
        value,
    );
}
export function showInfo(message: string) {
    vscode.window.showInformationMessage(message);
}
export function showError(message: string) {
    vscode.window.showErrorMessage(message);
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

export function activate(context: vscode.ExtensionContext) {
    BlocklypyViewerProvider.register(context);
    PybricksPythonPreviewProvider.register(context);

    registerCommandsTree(context);
    registerSettingsTree(context);

    const commands: [Commands, () => Promise<void>][] = [
        [Commands.ConnectDevice, connectDeviceAsync],
        [
            Commands.ConnectDeviceLastConnected,
            async () => await connectDeviceByNameAsync(Config.lastConnectedDevice),
        ],
        [Commands.CompileAndRun, compileAndRunAsync],
        [Commands.StartUserProgram, startUserProgramAsync],
        [Commands.StopUserProgram, stopUserProgramAsync],
        [Commands.DisconnectDevice, disconnectDeviceAsync],
        [
            Commands.ToggleAutoConnect,
            async () => {
                await Config.setEnableAutoConnect(!Config.enableAutoConnect);
                settingsTreeData.refresh();
            },
        ],
        [
            Commands.ToggleAutoStart,
            async () => {
                await Config.setEnableAutostart(!Config.enableAutostart);
                settingsTreeData.refresh();
            },
        ],
        [
            Commands.DisplayNextView,
            async () => {
                BlocklypyViewerProvider.activeViewer?.rotateViews(true);
            },
        ],
        [
            Commands.DisplayPreviousView,
            async () => {
                BlocklypyViewerProvider.activeViewer?.rotateViews(false);
            },
        ],
        [
            Commands.DisplayPreview,
            async () =>
                BlocklypyViewerProvider.activeViewer?.showView(ViewType.Preview),
        ],
        [
            Commands.DisplayPycode,
            async () => BlocklypyViewerProvider.activeViewer?.showView(ViewType.Pycode),
        ],
        [
            Commands.DisplayPseudo,
            async () => BlocklypyViewerProvider.activeViewer?.showView(ViewType.Pseudo),
        ],
        [
            Commands.DisplayGraph,
            async () => BlocklypyViewerProvider.activeViewer?.showView(ViewType.Graph),
        ],
        [
            Commands.showPythonPreview,
            async () => {
                const editor = vscode.window.activeTextEditor;
                if (editor && editor.document.languageId === 'python') {
                    await vscode.commands.executeCommand(
                        'vscode.openWith',
                        PybricksPythonPreviewProvider.encodeUri(editor.document.uri),
                        PybricksPythonPreviewProvider.viewType,
                        vscode.ViewColumn.Beside,
                    );
                } else {
                    vscode.window.showInformationMessage(
                        'Open a Python file to preview.',
                    );
                }
            },
        ],
        [Commands.StatusPlaceHolder, async () => {}],
    ];

    context.subscriptions.push(
        ...commands.map(([name, command]) =>
            vscode.commands.registerCommand(name, wrapErrorHandling(command)),
        ),
    );

    // autoconnect to last connected device
    if (Config.enableAutoConnect) {
        if (Config.lastConnectedDevice) {
            vscode.commands.executeCommand(Commands.ConnectDeviceLastConnected);
        } else {
            vscode.commands.executeCommand(Commands.ConnectDevice);
        }
    }

    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(
            onActiveEditorSaveCallback,
            null,
            context.subscriptions,
        ),
    );

    // context.subscriptions.push(
    //     vscode.window.registerWebviewPanelSerializer(EXTENSION_KEY'.blocklypyViewer', {
    //         async deserializeWebviewPanel(webviewPanel, state) {
    //             const uri = vscode.Uri.parse((state as any).uri);
    //             await blocklypyViewerProvider.activeViewer?.resolveCustomEditor(
    //                 { uri } as vscode.CustomDocument,
    //                 webviewPanel,
    //                 {} as vscode.CancellationToken,
    //             );
    //             // Retrieve stored state
    //             const storedState = await context.workspaceState.get(
    //                 `blocklypyViewerState:${uri.toString()}`,
    //             );
    //             blocklypyViewerProvider.activeViewer?.restoreState(
    //                 (storedState ?? state) as any,
    //             );
    //         },
    //     }),
    // );
}

export async function deactivate() {
    await wrapErrorHandling(stopUserProgramAsync);
    await wrapErrorHandling(disconnectDeviceAsync);
}

function onActiveEditorSaveCallback(document: vscode.TextDocument) {
    const activeEditor = vscode.window.activeTextEditor;

    if (activeEditor && activeEditor.document === document) {
        if (Config.enableAutostart && document.languageId === 'python') {
            // check if file is python and has magic header
            const line1 = document.lineAt(0).text;
            if (new RegExp(`\\b${MAGIC_AUTOSTART}\\b`).test(line1)) {
                console.log('AutoStart detected, compiling and running...');
                vscode.commands.executeCommand('blocklypy-vscode.compileAndRun');
            }
        }
    }
}

async function findEditorForFile(
    filename: string,
): Promise<vscode.TextEditor | undefined> {
    if (filename === MAIN_MOCULE_PATH) {
        return vscode.window.activeTextEditor;
    } else {
        // Check all open tabs in all tab groups
        for (const group of vscode.window.tabGroups.all) {
            for (const tab of group.tabs) {
                if (tab.input instanceof vscode.TabInputText) {
                    const fileName = tab.input.uri.fsPath;
                    if (fileName.endsWith(filename)) {
                        // Try to find a visible editor for this tab
                        const openEditor = vscode.window.visibleTextEditors.find(
                            (ed) => ed.document.fileName === fileName,
                        );
                        if (openEditor) {
                            return openEditor;
                        } else {
                            // Open the document if not visible
                            return await vscode.workspace
                                .openTextDocument(tab.input.uri)
                                .then((doc) =>
                                    vscode.window.showTextDocument(doc, {
                                        preview: false,
                                    }),
                                );
                        }
                    }
                }
            }
        }
    }
}

export function clearDebugLog() {
    DebugChannel.clear();
}

export async function reportPythonError(
    file: string | vscode.TextEditor,
    line: number,
    message: string,
) {
    const editor = typeof file === 'object' ? file : await findEditorForFile(file);
    if (!editor) {
        return;
    }

    const range = new vscode.Range(line, 0, line, 100); // highlight the whole line
    const diagnostic = new vscode.Diagnostic(
        range,
        message,
        vscode.DiagnosticSeverity.Error,
    );
    diagnosticsCollection.set(editor.document.uri, [diagnostic]);

    await showEditorErrorDecoration(editor.document.fileName, line, message);
}

export async function clearPythonErrors() {
    diagnosticsCollection.clear();
    await clearEditorErrorDecorations();
}

async function clearEditorErrorDecorations() {
    for (const group of vscode.window.tabGroups.all) {
        group.tabs.forEach((tab) => {
            if (tab.input instanceof vscode.TabInputText) {
                const fileName = tab.input.uri.fsPath;
                const openEditor = vscode.window.visibleTextEditors.find(
                    (ed) => ed.document.fileName === fileName,
                );
                openEditor?.setDecorations(decorationType, []);
            }
        });
    }
}

async function showEditorErrorDecoration(
    filename: string,
    line: number,
    errorMsg: string,
) {
    const editor = await findEditorForFile(filename);
    if (!editor) {
        return;
    }

    const range = new vscode.Range(line, 0, line, 0);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
    editor.selection = new vscode.Selection(line, 0, line, 0);
    editor.setDecorations(decorationType, [{ range, hoverMessage: errorMsg }]);
}

const decorationType = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    borderColor: 'red',
    borderStyle: 'solid',
    borderWidth: '0 0 2px 0',
    overviewRulerColor: 'red',
    overviewRulerLane: vscode.OverviewRulerLane.Full,
});

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
