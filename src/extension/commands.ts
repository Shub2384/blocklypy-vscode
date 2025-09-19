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
import { showInfo } from './diagnostics';
import { settingsTreeData } from './tree-settings';
import { openOrActivate } from './utils';

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

// Map configuration keys to their toggle commands and tooltips, title is taken from package.json
export const SettingsToggleCommandsMap: [ConfigKeys, Commands, string][] = [
    [
        ConfigKeys.DeviceAutoConnect,
        Commands.ToggleAutoConnect,
        'Auto-connect to last device connected.',
    ],
    [
        ConfigKeys.ProgramAutoStart,
        Commands.ToggleAutoStart,
        "Auto-start user program on save with '# LEGO autostart' in first line.",
    ],
    [
        ConfigKeys.TerminalAutoClear,
        Commands.ToggleAutoClearTerminal,
        'Auto-clear terminal before running.',
    ],
    [
        ConfigKeys.PlotAutosave,
        Commands.TogglePlotAutosave,
        'Auto-save plots to workspace folder using the "plot:" commands.',
    ],
];

const settingsCommandHandlers = Array.from(
    SettingsToggleCommandsMap.map(
        ([configkey, command]) =>
            [
                command,
                async () => {
                    await Config.toggleConfigValue(configkey);
                    settingsTreeData.refresh();
                },
            ] as [Commands, CommandHandler],
    ),
);

type CommandHandler =
    | ((...args: any[]) => Promise<any>)
    | ((...args: any[]) => Thenable<any>);

export const commandHandlers: Map<Commands, CommandHandler> = new Map([
    [Commands.ConnectDevice, connectDeviceAsyncAny],
    [Commands.Compile, compileAsync],
    [Commands.CompileAndRun, compileAndRunAsync],
    [Commands.StartUserProgram, startUserProgramAsync],
    [Commands.StopUserProgram, stopUserProgramAsync],
    [Commands.DisconnectDevice, disconnectDeviceAsync],
    [Commands.ClearAllSlots, clearAllSlots],
    ...settingsCommandHandlers,
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
                showInfo('Open a Python file to preview.');
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
]);
