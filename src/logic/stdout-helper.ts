import path from 'path';
import { logDebug } from '../extension/debug-channel';
import { reportPythonError, showInfoAsync } from '../extension/diagnostics';
import { PlotManager } from './plot';
import { parsePlotCommand } from './stdout-plot-helper';
import {
    resetPythonErrorParser as clearPythonErrorParser,
    parsePythonError,
} from './stdout-python-error-helper';

function handleReportPythonError(filename: string, line: number, message: string) {
    // onReport callback
    setTimeout(() => {
        reportPythonError(filename, line, message).catch(console.error);
    }, 0);
}

export async function handleStdOutDataHelpers(line: string) {
    // starts with "plot: "
    await parsePlotCommand(line, plotManager);

    // equal to  "Traceback (most recent call last):"
    parsePythonError(line, handleReportPythonError);
}

export function clearStdOutDataHelpers() {
    clearPythonErrorParser();
    plotManager?.resetPlotParser().catch(console.error);
}

export function registerStdoutHelper() {
    plotManager = PlotManager.createWithCb((filepath: string) => {
        // onCreate callback
        logDebug(`Started datalogging to ${filepath}`);
        showInfoAsync(`Started datalogging to ${path.basename(filepath)}`).catch(
            console.error,
        );
    });
}

export let plotManager: PlotManager | undefined = undefined;
