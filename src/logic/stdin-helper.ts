import { bleLayer } from '../clients/ble-layer';
import { hasState, StateProp } from './state';

export async function onTerminalUserInput(message: string): Promise<void> {
    if (hasState(StateProp.Connected)) return;
    await bleLayer.client?.sendTerminalUserInputAsync(message);
}
