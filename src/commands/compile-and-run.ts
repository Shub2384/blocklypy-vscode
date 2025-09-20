import * as vscode from 'vscode';

import { bleLayer } from '../clients/ble-layer';
import { clearDebugLog, logDebug } from '../extension/debug-channel';
import { clearPythonErrors } from '../extension/diagnostics';
import { compileAsync } from '../logic/compile';
import { hasState, StateProp } from '../logic/state';
import Config from '../utils/config';

export async function compileAndRunAsync(
    slot_input?: number,
    compileMode?: string,
): Promise<void> {
    clearPythonErrors();
    if (Config.terminalAutoClear) clearDebugLog();

    await vscode.window.withProgress(
        {
            location: { viewId: 'blocklypy-vscode-commands' },
            cancellable: false,
        },
        async () => {
            try {
                if (!hasState(StateProp.Connected) || !bleLayer.client)
                    throw new Error(
                        'No device selected. Please connect to a device first.',
                    );

                const {
                    data,
                    filename,
                    slot: slot_header,
                } = await compileAsync(compileMode);

                const slot = slot_header ?? slot_input;
                await bleLayer.client.action_stop();
                await bleLayer.client.action_upload(data, slot, filename);
                await bleLayer.client.action_start(slot);

                logDebug(
                    `User program compiled (${data.byteLength} bytes) and started successfully.`,
                );
            } catch (e) {
                logDebug(`${e}`);
            }
        },
    );
}
