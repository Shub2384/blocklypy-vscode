import { clearDebugLog, logDebug } from '../extension/debug-channel';
import { clearPythonErrors } from '../extension/diagnostics';
import { Device } from '../logic/ble';
import { compileAsync } from '../logic/compile';
import { setState, StateProp } from '../logic/state';
import {
    createWriteUserProgramMetaCommand,
    createWriteUserRamCommand,
} from '../pybricks/protocol';
import Config from '../utils/config';
import { startUserProgramAsync } from './start-user-program';
import { stopUserProgramAsync } from './stop-user-program';

export async function compileAndRunAsync() {
    clearPythonErrors();
    if (Config.autoClearTerminal) clearDebugLog();

    try {
        const blob = await compileAsync();

        if (!Device.current) {
            throw new Error(
                'No device selected. Please connect to a Pybricks device first.',
            );
        }

        const buffer = await Device.readCapabilities();
        const maxWriteSize = buffer?.readUInt16LE(0);
        const maxUserProgramSize = buffer?.readUInt32LE(6);
        if (
            maxWriteSize === undefined ||
            maxUserProgramSize === undefined ||
            blob.size > maxUserProgramSize
        ) {
            throw new Error(
                `User program size (${blob.size}) exceeds maximum allowed size (${maxUserProgramSize}).`,
            );
        }

        // await Device.write(createStopUserProgramCommand(), false);
        await stopUserProgramAsync();

        // Pybricks Code sends size 0 to clear the state before sending the new program, then sends the size on completion.
        setState(StateProp.Uploading, true);
        try {
            await Device.write(createWriteUserProgramMetaCommand(0), false);
            await Device.write(createWriteUserProgramMetaCommand(blob.size), false);

            const writeSize = maxWriteSize - 5; // 5 bytes for the header
            for (let offset = 0; offset < blob.size; offset += writeSize) {
                const chunk = blob.slice(offset, offset + writeSize);
                const chunkbuffer = await chunk.arrayBuffer();
                const buffer = createWriteUserRamCommand(offset, chunkbuffer);
                await Device.write(buffer, false);
            }
        } finally {
            setState(StateProp.Uploading, false);
        }

        // await Device.write(createLegacyStartUserProgramCommand(), false);
        await startUserProgramAsync();

        logDebug(
            `User program compiled (${blob.size} bytes) and started successfully.`,
        );
    } catch (e) {
        logDebug(`${e}`);
    }
}
