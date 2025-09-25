import * as vscode from 'vscode';
import { ConnectionManager } from '../communication/connection-manager';
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
    const handleStateChange = (event: StateChangeEvent) => {
        // --- Saga like behavior to handle specific state changes ---
        switch (event.prop) {
            case StateProp.Connected:
                setState(StateProp.Running, false);

                const msg = hasState(StateProp.Connected)
                    ? `Connected to ${ConnectionManager.client?.name}`
                    : 'Disconnected';
                setStatusBarItem(event.value, msg, msg);

                DevicesTree.refreshCurrentItem();
                break;

            case StateProp.Running:
                // program state notification arrives at a regular pace
                // it might happen that program sends text before program start notification arrives
                // as a workaround on stadout we set running to true
                clearStdOutDataHelpers();
                break;
        }

        // set all states as context
        Object.values(StateProp).forEach((prop) => {
            vscode.commands.executeCommand(
                'setContext',
                CONTEXT_BASE + 'is' + ToCapialized(String(prop)),
                hasState(prop),
            );
        });

        // refresh commands tree on any state change
        CommandsTree.refresh();
    };

    context.subscriptions.push(onStateChange(handleStateChange));
}

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
