import { bleLayer } from '../clients/ble-layer';
import { StateProp, withState } from './state';

export async function onTerminalUserInput(message: string): Promise<void> {
    withState(StateProp.Connected, () =>
        bleLayer.client?.sendTerminalUserInput(message),
    );
}
