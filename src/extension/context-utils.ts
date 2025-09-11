import * as vscode from 'vscode';
import { EXTENSION_KEY } from '../const';
import { onStateChange, setState, StateChangeEvent, StateProp } from '../logic/state';
import {
    BlocklypyViewerContentAvailabilityMap,
    ViewType,
} from '../views/BlocklypyViewerProvider';
import { TreeCommands } from './tree-commands';
import { ToCapialized } from './utils';

const CONTEXT_BASE = EXTENSION_KEY + '.';

export function registerContextUtils(): vscode.Disposable {
    const handleStateChange = (event: StateChangeEvent) => {
        switch (event.prop) {
            case StateProp.Connected:
                vscode.commands.executeCommand(
                    'setContext',
                    CONTEXT_BASE + 'isConnected',
                    event.value,
                );
                setState(StateProp.Connecting, false);
                setState(StateProp.Running, false);
                TreeCommands.refresh();
                break;
            case StateProp.Running:
                vscode.commands.executeCommand(
                    'setContext',
                    EXTENSION_KEY + '.isProgramRunning',
                    event.value,
                );
                TreeCommands.refresh();
                break;
        }
    };
    return onStateChange(handleStateChange);
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
export function setContextCustomViewType(value: ViewType | undefined) {
    vscode.commands.executeCommand(
        'setContext',
        CONTEXT_BASE + 'customViewType',
        value,
    );
}
export function setContextContentAvailability(
    content: BlocklypyViewerContentAvailabilityMap | undefined,
) {
    for (const key in content) {
        vscode.commands.executeCommand(
            'setContext',
            `${CONTEXT_BASE}contentAvailability.has${ToCapialized(key)}`,
            content[key as keyof BlocklypyViewerContentAvailabilityMap] === true,
        );
    }
}
