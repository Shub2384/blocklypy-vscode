import * as vscode from 'vscode';
import { disconnectDeviceAsync } from './commands/disconnect-device';
import { stopUserProgramAsync } from './commands/stop-user-program';
import { commandHandlers, Commands } from './extension/commands';
import { registerCommandsTree } from './extension/tree-commands';
import { registerSettingsTree } from './extension/tree-settings';
import { wrapErrorHandling } from './extension/utils';
import Config from './utils/config';
import { BlocklypyViewerProvider } from './views/BlocklypyViewerProvider';
import { PybricksPythonPreviewProvider } from './views/PybricksPythonPreviewProvider';
import { Device } from './logic/ble';
import { registerDevicesTree } from './extension/tree-devices';

export const EXTENSION_ID = 'afarago.blocklypy-vscode';

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
    registerDevicesTree(context);
    registerSettingsTree(context);

    context.subscriptions.push(
        ...Array.from(commandHandlers).map(([name, command]) =>
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

    // Start BLE scanning at startup and keep it running
    setTimeout(async () => {
        await Device.startScanning();

        // autoconnect to last connected device
        if (Config.autoConnect && Config.lastConnectedDevice) {
            setTimeout(async () => {
                vscode.commands.executeCommand(
                    Commands.ConnectDevice,
                    Config.lastConnectedDevice,
                );
            }, 1000);
        }
    }, 500);
}

export async function deactivate() {
    await wrapErrorHandling(stopUserProgramAsync);
    await wrapErrorHandling(disconnectDeviceAsync);
    await Device.stopScanningAsync();
}

function onActiveEditorSaveCallback(document: vscode.TextDocument) {
    const activeEditor = vscode.window.activeTextEditor;

    if (activeEditor && activeEditor.document === document) {
        if (Config.autostart && document.languageId === 'python') {
            // check if file is python and has magic header
            const line1 = document.lineAt(0).text;
            const regex = new RegExp(/^#\s*LEGO\b.*\bautostart\b/i);
            if (regex.test(line1)) {
                console.log('AutoStart detected, compiling and running...');
                vscode.commands.executeCommand(Commands.CompileAndRun);
            }
        }
    }
}

// process.on('uncaughtException', (err) => {
//     console.error('Uncaught Exception:', err);
//     // Optionally show a VS Code error message:
//     // vscode.window.showErrorMessage('Uncaught Exception: ' + err.message);
// });

// process.on('unhandledRejection', (reason, promise) => {
//     console.error('Unhandled Rejection:', reason);
//     // Optionally show a VS Code error message:
//     // vscode.window.showErrorMessage('Unhandled Rejection: ' + String(reason));
// });
