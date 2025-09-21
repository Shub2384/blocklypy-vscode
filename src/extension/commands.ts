import * as vscode from 'vscode';

import { clearAllSlots } from '../commands/clear-all-slots';
import { compileAndRunAsync } from '../commands/compile-and-run';
import { connectDeviceAsyncAny } from '../commands/connect-device';
import { disconnectDeviceAsync } from '../commands/disconnect-device';
import { startUserProgramAsync } from '../commands/start-user-program';
import { stopUserProgramAsync } from '../commands/stop-user-program';
import { compileAsync } from '../logic/compile';
import Config, { ConfigKeys } from '../utils/config';
import { BlocklypyViewerProvider, ViewType } from '../views/BlocklypyViewerProvider';
import { PybricksPythonPreviewProvider } from '../views/PybricksPythonPreviewProvider';
import { showInfoAsync } from './diagnostics';
import { SettingsTree } from './tree-settings';
import { openOrActivate as openOrActivateAsync, wrapErrorHandling } from './utils';

// Define the BlocklyPyCommand enum for all command strings
export enum Commands {
    ConnectDevice = 'blocklypy-vscode.connectDevice',
    DisconnectDevice = 'blocklypy-vscode.disconnectDevice',
    Compile = 'blocklypy-vscode.compile',
    CompileAndRun = 'blocklypy-vscode.compileAndRun',
    StartUserProgram = 'blocklypy-vscode.startUserProgram',
    StopUserProgram = 'blocklypy-vscode.stopUserProgram',
    StatusPlaceHolder = 'blocklypy-vscode.statusPlaceholder',
    ToggleAutoConnect = 'blocklypy-vscode.toggleAutoConnect',
    ToggleAutoStart = 'blocklypy-vscode.toggleAutoStart',
    ToggleAutoClearTerminal = 'blocklypy-vscode.toggleAutoClearTerminal',
    TogglePlotAutosave = 'blocklypy-vscode.toggleAutoSavePlot',
    DisplayNextView = 'blocklypy-vscode.blocklypyViewer.displayNextView',
    DisplayPreviousView = 'blocklypy-vscode.blocklypyViewer.displayPreviousView',
    DisplayPreview = 'blocklypy-vscode.blocklypyViewer.displayPreview',
    DisplayPycode = 'blocklypy-vscode.blocklypyViewer.displayPycode',
    DisplayPseudo = 'blocklypy-vscode.blocklypyViewer.displayPseudo',
    DisplayGraph = 'blocklypy-vscode.blocklypyViewer.displayGraph',
    ShowPythonPreview = 'blocklypy-vscode.showPythonPreview',
    ShowSource = 'blocklypy-vscode.pythonPreview.showSource',
    ClearAllSlots = 'blocklypy-vscode.clearAllSlots',
}

export const CommandMetaData: CommandMetaDataEntryExtended[] = [
    {
        command: Commands.ToggleAutoStart,
        title: 'Toggle Auto-Start',
        icon: '$(play)',
        tooltip:
            "Auto-start user program on save with '# LEGO autostart' in first line.",
        configkeyForHandler: ConfigKeys.ProgramAutoStart,
    },
    {
        command: Commands.ToggleAutoConnect,
        title: 'Toggle Auto-Connect',
        icon: '$(clear-all)',
        tooltip: 'Auto-connect to last device connected.',
        configkeyForHandler: ConfigKeys.DeviceAutoConnect,
    },
    {
        command: Commands.ToggleAutoClearTerminal,
        title: 'Toggle Auto-Clear Terminal',
        icon: '$(clear-all)',
        tooltip: 'Auto-clear terminal before running.',
        configkeyForHandler: ConfigKeys.TerminalAutoClear,
    },
    {
        command: Commands.TogglePlotAutosave,
        title: 'Toggle Auto-Save Plot Data',
        icon: '$(file-symlink-file)',
        tooltip: 'Auto-save plots to workspace folder using the "plot:" commands.',
        configkeyForHandler: ConfigKeys.PlotAutosave,
    },
    {
        command: Commands.StatusPlaceHolder,
        title: 'Status',
        icon: '$(debug-stackframe)',
        handler: async () => {},
    },
    {
        command: Commands.DisplayNextView,
        handler: async () => {
            await BlocklypyViewerProvider.Get?.rotateViewsAsync(true);
        },
    },
    {
        command: Commands.DisplayPreviousView,
        handler: async () => {
            await BlocklypyViewerProvider.Get?.rotateViewsAsync(false);
        },
    },
    {
        command: Commands.DisplayPycode,
        handler: async () =>
            BlocklypyViewerProvider.Get?.showViewAsync(ViewType.Pycode),
    },
    {
        command: Commands.DisplayPseudo,
        handler: async () =>
            BlocklypyViewerProvider.Get?.showViewAsync(ViewType.Pseudo),
    },
    {
        command: Commands.DisplayPreview,
        handler: async () =>
            BlocklypyViewerProvider.Get?.showViewAsync(ViewType.Preview),
    },
    {
        command: Commands.DisplayGraph,
        handler: async () => BlocklypyViewerProvider.Get?.showViewAsync(ViewType.Graph),
    },
    {
        command: Commands.ShowPythonPreview,
        handler: async () => {
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
                await showInfoAsync('Open a Python file to preview.');
            }
        },
    },
    {
        command: Commands.ShowSource,
        handler: async () => {
            const uri: vscode.Uri | undefined =
                PybricksPythonPreviewProvider.Get?.ActiveUri;
            if (!uri) return;
            const origialUri = PybricksPythonPreviewProvider.decodeUri(uri);
            await openOrActivateAsync(origialUri);
        },
    },
    {
        command: Commands.ConnectDevice,
        handler: connectDeviceAsyncAny,
    },
    {
        command: Commands.Compile,
        handler: compileAsync,
    },
    {
        command: Commands.CompileAndRun,
        handler: async () => void (await compileAndRunAsync()),
    },
    {
        command: Commands.StartUserProgram,
        handler: async () => void (await startUserProgramAsync()),
    },
    {
        command: Commands.StopUserProgram,
        handler: stopUserProgramAsync,
    },
    {
        command: Commands.DisconnectDevice,
        handler: disconnectDeviceAsync,
    },
    {
        command: Commands.ClearAllSlots,
        handler: clearAllSlots,
    },
];

export type CommandMetaDataEntry = {
    command: Commands;
    title?: string;
    icon?: string | { light: string; dark: string };
};

type CommandMetaDataEntryExtended = CommandMetaDataEntry & {
    tooltip?: string;
    configkeyForHandler?: ConfigKeys;
    handler?: CommandHandler;
};

type CommandHandler = (...args: unknown[]) => Promise<unknown>;

function getHandler(entry: CommandMetaDataEntryExtended): CommandHandler | undefined {
    if (entry.handler) {
        return wrapErrorHandling((...args: unknown[]) => entry.handler!(...args));
    }
    if (entry.configkeyForHandler) {
        return async () => {
            await Config.toggleConfigValue(entry.configkeyForHandler!);
            SettingsTree.refresh();
        };
    }
    return undefined;
}

export function registerCommands(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        ...CommandMetaData.map((cmd) =>
            vscode.commands.registerCommand(
                cmd.command,
                getHandler(cmd) ??
                    (async () => {
                        await showInfoAsync(
                            `Command "${cmd.command}" not implemented yet.`,
                        );
                    }),
            ),
        ),
    );
}

export const SettingsToggleCommandsMap = CommandMetaData.filter((cmd) =>
    Boolean(cmd.configkeyForHandler),
).map(
    (cmd) => [cmd.configkeyForHandler!, cmd.title, cmd.command, cmd.tooltip] as const,
);

const PACKAGEJSON_COMMAND_PREFIX = 'BlocklyPy Commander: ';
let _commandsFromPackageJsonCache: CommandMetaDataEntry[];
export function getCommandsFromPackageJson(
    context: vscode.ExtensionContext,
): CommandMetaDataEntry[] {
    if (_commandsFromPackageJsonCache) return _commandsFromPackageJsonCache;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const packageEntries = context.extension.packageJSON.contributes
        .commands as CommandMetaDataEntry[];
    for (const entry of packageEntries) {
        if (entry.title?.startsWith(PACKAGEJSON_COMMAND_PREFIX)) {
            entry.title = entry.title.replace(PACKAGEJSON_COMMAND_PREFIX, '');
        }
    }
    _commandsFromPackageJsonCache = packageEntries.concat(CommandMetaData);

    return _commandsFromPackageJsonCache;
}
