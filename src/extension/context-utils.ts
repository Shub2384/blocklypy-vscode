import * as vscode from 'vscode';
import {
    BlocklypyViewerContentAvailabilityMap,
    ViewType,
} from '../views/BlocklypyViewerProvider';
import { EXTENSION_KEY } from '../const';
import { ToCapialized } from './utils';

const CONTEXT_BASE = EXTENSION_KEY + '.';

export function setContextIsProgramRunning(value: boolean) {
    vscode.commands.executeCommand(
        'setContext',
        CONTEXT_BASE + 'isProgramRunning',
        value,
    );
}
export function setContextIsConnected(value: boolean) {
    vscode.commands.executeCommand('setContext', CONTEXT_BASE + 'isConnected', value);
}
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
