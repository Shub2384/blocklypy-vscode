import path from 'path';
import { logDebug } from '../extension/debug-channel';
import { reportPythonError, showInfo } from '../extension/diagnostics';
import {
    resetPlotParser as clearPlotParser,
    parsePlotCommand,
} from './stdout-plot-helper';
import {
    resetPythonErrorParser as clearPythonErrorParser,
    parsePythonError,
} from './stdout-python-error-helper';

function handleOnPlotFileCreate(filepath: string) {
    // onCreate callback
    logDebug(`Started datalogging to ${filepath}`);
    showInfo(`Started datalogging to ${path.basename(filepath)}`);
}

function handleReportPythonError(filename: string, line: number, message: string) {
    // onReport callback
    setTimeout(async () => {
        await reportPythonError(filename, line, message);
    }, 0);
}

export async function handleStdOutData(text: string) {
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
        // starts with "plot: "
        await parsePlotCommand(line, handleOnPlotFileCreate);

        // equal to  "Traceback (most recent call last):"
        await parsePythonError(line, handleReportPythonError);
    }
}

export function clearStdOutDataHelpers() {
    clearPlotParser();
    clearPythonErrorParser();
}
