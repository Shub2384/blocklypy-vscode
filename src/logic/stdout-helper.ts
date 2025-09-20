import path from 'path';
import { logDebug } from '../extension/debug-channel';
import { reportPythonError, showInfo } from '../extension/diagnostics';
import { PlotManager } from './plot';
import { parsePlotCommand } from './stdout-plot-helper';
import {
    resetPythonErrorParser as clearPythonErrorParser,
    parsePythonError,
} from './stdout-python-error-helper';

function handleReportPythonError(filename: string, line: number, message: string) {
    // onReport callback
    setTimeout(async () => {
        await reportPythonError(filename, line, message);
    }, 0);
}

export async function handleStdOutDataHelpers(line: string) {
    // starts with "plot: "
    await parsePlotCommand(line, plotManager);

    // equal to  "Traceback (most recent call last):"
    await parsePythonError(line, handleReportPythonError);
}

export function clearStdOutDataHelpers() {
    plotManager?.resetPlotParser();
    clearPythonErrorParser();
}

export function registerStdoutHelper() {
    plotManager = PlotManager.createWithCb((filepath: string) => {
        // onCreate callback
        logDebug(`Started datalogging to ${filepath}`);
        showInfo(`Started datalogging to ${path.basename(filepath)}`);
    });
}

export let plotManager: PlotManager | undefined = undefined;
