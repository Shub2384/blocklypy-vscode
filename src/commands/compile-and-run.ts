import * as vscode from 'vscode';

import { bleLayer } from '../clients/ble-layer';
import { clearDebugLog, logDebug } from '../extension/debug-channel';
import { clearPythonErrors } from '../extension/diagnostics';
import { compileAsync } from '../logic/compile';
import { hasState, StateProp } from '../logic/state';
import Config from '../utils/config';

export async function compileAndRunAsync(
    slot?: number,
    compileMode?: string,
): Promise<void> {
    clearPythonErrors();
    if (Config.terminalAutoClear) clearDebugLog();

    vscode.window.withProgress(
        {
            location: { viewId: 'blocklypy-vscode-commands' },
            cancellable: false,
        },
        async () => {
            try {
                if (!hasState(StateProp.Connected) || !bleLayer.client)
                    throw new Error(
                        'No device selected. Please connect to a Pybricks device first.',
                    );

                const [data, filename] = await compileAsync(compileMode);

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
