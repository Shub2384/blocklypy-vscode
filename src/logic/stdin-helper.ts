import { ConnectionManager } from '../communication/connection-manager';
import { hasState, StateProp } from './state';

export async function onTerminalUserInput(message: string): Promise<void> {
    if (hasState(StateProp.Connected)) return;
    await ConnectionManager.client?.sendTerminalUserInputAsync(message);
}
