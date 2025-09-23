import * as vscode from 'vscode';

import { HubOSBaseClient } from '../communication/clients/hubos-base-client';
import { HubOSBleClient } from '../communication/clients/hubos-ble-client';
import { HubOSUsbClient } from '../communication/clients/hubos-usb-client';
import { ConnectionManager } from '../communication/connection-manager';
import { hasState, StateProp } from '../logic/state';

export async function clearAllSlots() {
    if (!hasState(StateProp.Connected) || !ConnectionManager.client) {
        throw new Error('No device selected. Please connect to a device first.');
    }

    if (
        ![HubOSBleClient.devtype, HubOSUsbClient.devtype].includes(
            ConnectionManager.client.devtype,
        )
    ) {
        throw new Error(
            `The connected device (${ConnectionManager.client.devtype}) does not support clearing all slots.`,
        );
    }

    const confirmed =
        (await vscode.window.showWarningMessage(
            'Are you sure you want to clear all slots? This action cannot be undone.',
            { modal: true },
            'Yes',
        )) === 'Yes';
    if (!confirmed) return;

    // clear all slots
    await (ConnectionManager.client as HubOSBaseClient).action_clear_all_slots();

    // workaround to reset to heart slot
    await ConnectionManager.client.action_start(0);
}
