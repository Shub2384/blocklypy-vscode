import * as vscode from 'vscode';
import { compileAndRunAsync } from './commands/compile-and-run';
import {
    connectDeviceAsync,
    connectDeviceByNameAsync,
} from './commands/connect-device';
import { disconnectDeviceAsync } from './commands/disconnect-device';
import { startUserProgramAsync } from './commands/start-user-program';
import { stopUserProgramAsync } from './commands/stop-user-program';
import { Commands } from './extension/commands';
import { registerCommandsTree } from './extension/tree-commands';
import { registerSettingsTree, settingsTreeData } from './extension/tree-settings';
import { openOrActivate, wrapErrorHandling } from './extension/utils';
import Config from './utils/config';
import { BlocklypyViewerProvider, ViewType } from './views/BlocklypyViewerProvider';
import { PybricksPythonPreviewProvider } from './views/PybricksPythonPreviewProvider';
import { compileAsync } from './logic/compile';

export function activate(context: vscode.ExtensionContext) {
    BlocklypyViewerProvider.register(
        context,
        BlocklypyViewerProvider,
        BlocklypyViewerProvider.TypeKey,
    );
    PybricksPythonPreviewProvider.register(
        context,
        PybricksPythonPreviewProvider,
        PybricksPythonPreviewProvider.TypeKey,
    );

    registerCommandsTree(context);
    registerSettingsTree(context);

    const commands: [Commands, () => Promise<void>][] = [
        [Commands.ConnectDevice, connectDeviceAsync],
        [
            Commands.ConnectDeviceLastConnected,
            async () => await connectDeviceByNameAsync(Config.lastConnectedDevice),
        ],
        [
            Commands.Compile,
            async () => {
                await compileAsync();
            },
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
                BlocklypyViewerProvider.Get?.rotateViews(true);
            },
        ],
        [
            Commands.DisplayPreviousView,
            async () => {
                BlocklypyViewerProvider.Get?.rotateViews(false);
            },
        ],
        [
            Commands.DisplayPreview,
            async () => BlocklypyViewerProvider.Get?.showView(ViewType.Preview),
        ],
        [
            Commands.DisplayPycode,
            async () => BlocklypyViewerProvider.Get?.showView(ViewType.Pycode),
        ],
        [
            Commands.DisplayPseudo,
            async () => BlocklypyViewerProvider.Get?.showView(ViewType.Pseudo),
        ],
        [
            Commands.DisplayGraph,
            async () => BlocklypyViewerProvider.Get?.showView(ViewType.Graph),
        ],
        [
            Commands.ShowPythonPreview,
            async () => {
                const editor = vscode.window.activeTextEditor;
                if (editor && editor.document.languageId === 'python') {
                    await vscode.commands.executeCommand(
                        'vscode.openWith',
                        PybricksPythonPreviewProvider.encodeUri(editor.document.uri),
                        PybricksPythonPreviewProvider.TypeKey,
                        {
                            viewColumn: vscode.ViewColumn.Beside,
                            preview: true,
                        },
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

    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(
            onActiveEditorSaveCallback,
            null,
            context.subscriptions,
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
            const regex = new RegExp(/^#\s*LEGO\b.*\bautostart\b/i);
            console.log('Checking for autostart header:', line1, regex);
            if (regex.test(line1)) {
                console.log('AutoStart detected, compiling and running...');
                vscode.commands.executeCommand(Commands.CompileAndRun);
            }
        }
    }
}
