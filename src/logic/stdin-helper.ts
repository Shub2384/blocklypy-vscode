import { CommLayerManager } from '../clients/manager';
import { hasState, StateProp } from './state';

export async function onTerminalUserInput(message: string): Promise<void> {
    if (hasState(StateProp.Connected)) return;
    await CommLayerManager.client?.sendTerminalUserInputAsync(message);
}
