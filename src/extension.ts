import * as vscode from 'vscode';
import { bleLayer } from './clients/ble-layer';
import { connectDeviceAsync } from './commands/connect-device';
import { disconnectDeviceAsync } from './commands/disconnect-device';
import { stopUserProgramAsync } from './commands/stop-user-program';
import { Commands, registerCommands } from './extension/commands';
import { registerContextUtils } from './extension/context-utils';
import { logDebug, registerDebugTerminal } from './extension/debug-channel';
import { clearPythonErrors } from './extension/diagnostics';
import { registerCommandsTree } from './extension/tree-commands';
import { registerDevicesTree } from './extension/tree-devices';
import { registerSettingsTree } from './extension/tree-settings';
import { wrapErrorHandling } from './extension/utils';
import { checkMagicHeaderComment } from './logic/compile';
import { onTerminalUserInput } from './logic/stdin-helper';
import Config from './utils/config';
import { BlocklypyViewerProvider } from './views/BlocklypyViewerProvider';
import { DatalogView } from './views/DatalogView';
import { PybricksPythonPreviewProvider } from './views/PybricksPythonPreviewProvider';

export const EXTENSION_ID = 'afarago.blocklypy-vscode';

export let isDevelopmentMode: boolean;

export function activate(context: vscode.ExtensionContext) {
    isDevelopmentMode = context.extensionMode === vscode.ExtensionMode.Development;

    // First, register all commands explicitly
    registerCommands(context);

    // register webview providers
    context.subscriptions.push(
        BlocklypyViewerProvider.register(
            context,
            BlocklypyViewerProvider,
            BlocklypyViewerProvider.TypeKey,
        ),
    );
    context.subscriptions.push(
        PybricksPythonPreviewProvider.register(
            context,
            PybricksPythonPreviewProvider,
            PybricksPythonPreviewProvider.TypeKey,
        ),
    );

    // register datalog view
    DatalogView.register(context);

    // register tree views
    registerCommandsTree(context);
    registerDevicesTree(context);
    registerSettingsTree(context);

    // listen to file saves
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(
            onActiveEditorSaveCallback,
            null,
            context.subscriptions,
        ),
    );

    // clear python errors on document change
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument((e) => {
            if (e.document.languageId === 'python') {
                clearPythonErrors();
            }
        }),
    );

    // listen to state changes and update contexts
    registerContextUtils(context);
    // context.subscriptions.push(registerDebugTerminal(sendDataToHubStdin));
    registerDebugTerminal(context, (input) => {
        void onTerminalUserInput(input);
    });

    // Start BLE scanning at startup and keep it running
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    setTimeout(async () => {
        logDebug('BlocklyPy Commander started up successfully.', true);

        await bleLayer.waitForReadyAsync();
        // await Device.startScanning();

        // autoconnect to last connected device
        if (Config.deviceAutoConnect && Config.deviceLastConnected) {
            await bleLayer.waitTillDeviceAppearsAsync(
                Config.deviceLastConnected,
                10000,
            );
            await connectDeviceAsync(Config.deviceLastConnected);
        }
    }, 500);
}

export async function deactivate() {
    try {
        // Place cleanup logic here
        await wrapErrorHandling(stopUserProgramAsync)();
        await wrapErrorHandling(disconnectDeviceAsync)();
        bleLayer.stopScanning();
    } catch (err) {
        console.error('Error during deactivation:', err);
    }
}

async function onActiveEditorSaveCallback(document: vscode.TextDocument) {
    const activeEditor = vscode.window.activeTextEditor;

    if (activeEditor && activeEditor.document === document) {
        if (Config.programAutostart && document.languageId === 'python') {
            // check if file is python and has magic header
            const line1 = document.lineAt(0).text;

            // check for the autostart in the header (header exists, autostart is included)
            if (checkMagicHeaderComment(line1)?.autostart) {
                console.log('AutoStart detected, compiling and running...');
                await vscode.commands.executeCommand(Commands.CompileAndRun);
            }
        }
    }
}

export function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

process.on('uncaughtException', (err) => {
    if (isDevelopmentMode) console.error('Uncaught Exception:', err);
    // Optionally show a VS Code error message:
    // vscode.window.showErrorMessage('Uncaught Exception: ' + err.message);
});

process.on('unhandledRejection', (reason, promise) => {
    if (isDevelopmentMode) console.error('Unhandled Rejection:', reason);
    // Optionally show a VS Code error message:
    // vscode.window.showErrorMessage('Unhandled Rejection: ' + String(reason));
});
