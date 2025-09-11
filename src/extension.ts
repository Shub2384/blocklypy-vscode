import * as vscode from 'vscode';
import { connectDeviceAsync } from './commands/connect-device';
import { disconnectDeviceAsync } from './commands/disconnect-device';
import { stopUserProgramAsync } from './commands/stop-user-program';
import { commandHandlers, Commands } from './extension/commands';
import { registerContextUtils } from './extension/context-utils';
import { registerCommandsTree } from './extension/tree-commands';
import { registerDevicesTree } from './extension/tree-devices';
import { registerSettingsTree } from './extension/tree-settings';
import { wrapErrorHandling } from './extension/utils';
import { Device } from './logic/ble';
import Config from './utils/config';
import { BlocklypyViewerProvider } from './views/BlocklypyViewerProvider';
import { PybricksPythonPreviewProvider } from './views/PybricksPythonPreviewProvider';

export const EXTENSION_ID = 'afarago.blocklypy-vscode';

export function activate(context: vscode.ExtensionContext) {
    isDevelopmentMode = context.extensionMode === vscode.ExtensionMode.Development;

    // First, register all commands explicitly
    context.subscriptions.push(
        ...Array.from(commandHandlers).map(([name, command]) =>
            vscode.commands.registerCommand(name, wrapErrorHandling(command)),
        ),
    );

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

    // register tree views
    context.subscriptions.push(registerCommandsTree(context));
    context.subscriptions.push(registerDevicesTree(context));
    context.subscriptions.push(registerSettingsTree(context));

    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(
            onActiveEditorSaveCallback,
            null,
            context.subscriptions,
        ),
    );

    // listen to state changes and update contexts
    context.subscriptions.push(registerContextUtils());

    // Start BLE scanning at startup and keep it running
    const startScanningAndAutoConnect = async () => {
        Device.startScanning();

        // await delay(1000); // wait a bit for initial scan results
        // wait with timeout until device comes in

        // autoconnect to last connected device
        if (Config.autoConnect && Config.lastConnectedDevice) {
            await Device.waitTillDeviceAppearsAsync(Config.lastConnectedDevice, 10000);
            await connectDeviceAsync(Config.lastConnectedDevice);
        }
    };
    startScanningAndAutoConnect().catch((err) => console.error(err));
}

export async function deactivate() {
    try {
        await wrapErrorHandling(stopUserProgramAsync);
        await wrapErrorHandling(disconnectDeviceAsync);
        await Device.stopScanningAsync();
    } catch (err) {
        console.error('Error during deactivation:', err);
    }
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

export function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export let isDevelopmentMode: boolean;

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
