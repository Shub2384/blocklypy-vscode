import { logDebug } from '../extension/debug-channel';
import { clearPythonErrors } from '../extension/diagnostics';
import { Device } from '../logic/ble';
import { compileAsync } from '../logic/compile';
import {
    createLegacyStartUserProgramCommand,
    createStopUserProgramCommand,
    createWriteUserProgramMetaCommand,
    createWriteUserRamCommand,
} from '../pybricks/protocol';

export async function compileAndRunAsync() {
    // clearDebugLog();
    clearPythonErrors();

    if (!Device.Current) {
        throw new Error(
            'No device selected. Please connect to a Pybricks device first.',
        );
    }
    const blob = await compileAsync();
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

    await Device.write(createStopUserProgramCommand(), false);
    // Pybricks Code sends size 0 to clear the state before sending the new program, then sends the size on completion.
    await Device.write(createWriteUserProgramMetaCommand(0), false);
    await Device.write(createWriteUserProgramMetaCommand(blob.size), false);

    const writeSize = maxWriteSize - 5; // 5 bytes for the header
    for (let offset = 0; offset < blob.size; offset += writeSize) {
        const chunk = blob.slice(offset, offset + writeSize);
        const chunkbuffer = await chunk.arrayBuffer();
        const buffer = createWriteUserRamCommand(offset, chunkbuffer);
        await Device.write(buffer, false);
    }

    await Device.write(createLegacyStartUserProgramCommand(), false);
    logDebug(`User program compiled (${blob.size} bytes) and started successfully.`);
}
