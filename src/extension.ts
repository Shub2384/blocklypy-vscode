import * as vscode from 'vscode';
import { compileAndRunAsync } from './commands/compile-and-run';
import {
    connectDeviceAsync,
    connectDeviceByNameAsync,
} from './commands/connect-device';
import { disconnectDeviceAsync } from './commands/disconnect-device';
import { startUserProgramAsync } from './commands/start-user-program';
import { stopUserProgramAsync } from './commands/stop-user-program';
import { MAGIC_AUTOSTART } from './const';
import { Commands } from './extension/commands';
import { registerCommandsTree } from './extension/tree-commands';
import { registerSettingsTree, settingsTreeData } from './extension/tree-settings';
import { openOrActivate, wrapErrorHandling } from './extension/utils';
import Config from './utils/config';
import { BlocklypyViewerProvider, ViewType } from './views/BlocklypyViewerProvider';
import { PybricksPythonPreviewProvider } from './views/PybricksPythonPreviewProvider';

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
                BlocklypyViewerProvider.Provider?.rotateViews(true);
            },
        ],
        [
            Commands.DisplayPreviousView,
            async () => {
                BlocklypyViewerProvider.Provider?.rotateViews(false);
            },
        ],
        [
            Commands.DisplayPreview,
            async () => BlocklypyViewerProvider.Provider?.showView(ViewType.Preview),
        ],
        [
            Commands.DisplayPycode,
            async () => BlocklypyViewerProvider.Provider?.showView(ViewType.Pycode),
        ],
        [
            Commands.DisplayPseudo,
            async () => BlocklypyViewerProvider.Provider?.showView(ViewType.Pseudo),
        ],
        [
            Commands.DisplayGraph,
            async () => BlocklypyViewerProvider.Provider?.showView(ViewType.Graph),
        ],
        [
            Commands.ShowPythonPreview,
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
        [
            Commands.ShowSource,
            async () => {
                const uri: vscode.Uri | undefined =
                    PybricksPythonPreviewProvider.Get?.ActiveUri;
                if (!uri) return;
                const origialUri = PybricksPythonPreviewProvider.decodeUri(uri);
                openOrActivate(origialUri);
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
                vscode.commands.executeCommand(Commands.CompileAndRun);
            }
        }
    }
}
