import * as vscode from 'vscode';
import { bleLayer } from '../clients/ble-layer';
import { EXTENSION_KEY } from '../const';
import {
    hasState,
    onStateChange,
    setState,
    StateChangeEvent,
    StateProp,
} from '../logic/state';
import { clearStdOutDataHelpers } from '../logic/stdout-helper';
import {
    BlocklypyViewerContentAvailabilityMap,
    ViewType,
} from '../views/BlocklypyViewerProvider';
import { setStatusBarItem } from './statusbar';
import { CommandsTree } from './tree-commands';
import { DevicesTree } from './tree-devices';
import { ToCapialized } from './utils';

const CONTEXT_BASE = EXTENSION_KEY + '.';

// saga like bahaviour for context management
export function registerContextUtils(context: vscode.ExtensionContext) {
    const handleStateChange = async (event: StateChangeEvent) => {
        // refresh commands tree on any state change
        CommandsTree.refresh();

        // handle specific state changes
        switch (event.prop) {
            case StateProp.Connected:
                await vscode.commands.executeCommand(
                    'setContext',
                    CONTEXT_BASE + 'isConnected',
                    event.value,
                );
                setState(StateProp.Connecting, false);
                setState(StateProp.Running, false);

                const msg = hasState(StateProp.Connected)
                    ? `Connected to ${bleLayer.client?.name}`
                    : 'Disconnected';
                setStatusBarItem(event.value, msg, msg);

                DevicesTree.refreshCurrentItem();
                break;

            case StateProp.Running:
                await vscode.commands.executeCommand(
                    'setContext',
                    EXTENSION_KEY + '.isProgramRunning',
                    event.value,
                );

                // program state notification arrives at a regular pace
                // it might happen that program sends text before program start notification arrives
                // as a workaround on stadout we set running to true
                clearStdOutDataHelpers();
                break;
        }
    };

    context.subscriptions.push(onStateChange(handleStateChange));
}

// export function setContextIsProgramRunning(value: boolean) {
//     // TODO: do this automatically when the status characteristic changes
//     vscode.commands.executeCommand(
//         'setContext',
//         CONTEXT_BASE + 'isProgramRunning',
//         value,
//     );
// }
// export function setContextIsConnected(value: boolean) {
//     vscode.commands.executeCommand('setContext', CONTEXT_BASE + 'isConnected', value);
// }
export async function setContextCustomViewType(value: ViewType | undefined) {
    await vscode.commands.executeCommand(
        'setContext',
        CONTEXT_BASE + 'customViewType',
        value,
    );
}

export async function setContextContentAvailability(
    content: BlocklypyViewerContentAvailabilityMap | undefined,
) {
    for (const key in content) {
        await vscode.commands.executeCommand(
            'setContext',
            `${CONTEXT_BASE}contentAvailability.has${ToCapialized(key)}`,
            content[key as keyof BlocklypyViewerContentAvailabilityMap] === true,
        );
    }
}

export async function setContextPlotDataAvailability(value: boolean) {
    await vscode.commands.executeCommand(
        'setContext',
        `${CONTEXT_BASE}isPlotDataAvailable`,
        value,
    );
}
