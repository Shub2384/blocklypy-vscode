import * as vscode from 'vscode';

import { BleHubOsClient } from '../clients/ble-hubos-client';
import { CommLayerManager } from '../clients/manager';
import { UsbHubOsClient } from '../clients/usb-hubos-client';
import { hasState, StateProp } from '../logic/state';

export async function clearAllSlots() {
    if (!hasState(StateProp.Connected) || !CommLayerManager.client) {
        throw new Error('No device selected. Please connect to a device first.');
    }

    if (
        ![BleHubOsClient.devtype, UsbHubOsClient.devtype].includes(
            CommLayerManager.client.devtype,
        )
    ) {
        throw new Error(
            `The connected device (${CommLayerManager.client.devtype}) does not support clearing all slots.`,
        );
    }

    const confirmed =
        (await vscode.window.showWarningMessage(
            'Are you sure you want to clear all slots? This action cannot be undone.',
            { modal: true },
            'Yes',
        )) === 'Yes';
    if (!confirmed) return;

    if (CommLayerManager.client.devtype === BleHubOsClient.devtype)
        await (CommLayerManager.client as BleHubOsClient).action_clear_all_slots();
    if (CommLayerManager.client.devtype === UsbHubOsClient.devtype)
        await (CommLayerManager.client as UsbHubOsClient).action_clear_all_slots();

    // workaround to reset to heart slot
    await CommLayerManager.client.action_start(0);
}
