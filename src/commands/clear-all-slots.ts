import { bleLayer } from '../clients/ble-layer';
import { BleSpikeClient } from '../clients/ble-spike-client';
import { hasState, StateProp } from '../logic/state';

export async function clearAllSlots() {
    if (!hasState(StateProp.Connected) || !bleLayer.client) {
        throw new Error('No device selected. Please connect to a device first.');
    }

    if (bleLayer.client.devtype !== BleSpikeClient.devtype) {
        throw new Error(
            `The connected device (${bleLayer.client.devtype}) does not support clearing all slots.`,
        );
    }

    await (bleLayer.client as BleSpikeClient).action_clear_all_slots();
}
