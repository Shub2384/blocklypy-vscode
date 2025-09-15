import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'vscode';
import Config from '../utils/config';
import { getActiveFileFolder } from '../utils/files';
import { DatalogView } from '../views/DatalogView';

let initialized = false;
let logFile: fs.WriteStream | null = null;
let startTime: number = 0;
let columns: string[] | undefined = undefined;
let buffer: number[] | undefined = undefined;
let bufferTimeout: NodeJS.Timeout | null = null;

export const BUFFER_FLUSH_TIMEOUT = 1000; // ms
export const PLOT_COMMAND_PREFIX = 'plot:';

export const onPlotStarted = new EventEmitter<string[]>();
export const onPlotData = new EventEmitter<number[]>();

function getTimestamp(): number {
    const now = Date.now();
    const seconds = ((now - startTime) / 1000).toFixed(3);
    return Number(seconds);
}

export function getDatalogColumns(): string[] {
    return ['timestamp', ...(columns ?? [])];
}

export function getDatalogData(): number[][] {
    return buffer ? [buffer] : [];
}

function openLogFile() {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const year = now.getFullYear();
    const month = pad(now.getMonth() + 1);
    const day = pad(now.getDate());
    const hour = pad(now.getHours());
    const minute = pad(now.getMinutes());
    const second = pad(now.getSeconds());
    const filename = `datalog-${year}${month}${day}-${hour}${minute}${second}.csv`;
    const folder = getActiveFileFolder();
    if (!folder) {
        console.error('Cannot determine folder to save datalog file.');
        return;
    }
    const filePath = path.join(folder, filename);
    logFile = fs.createWriteStream(filePath, { flags: 'w', flush: true });
}

export async function closeLogFile() {
    if (logFile) {
        await new Promise<void>((resolve, reject) => {
            logFile!.end(() => {
                logFile = null;
                resolve();
            });
            logFile!.on('error', reject);
        });
    }
    columns = undefined;
    buffer = undefined;
    startTime = 0;
    if (bufferTimeout) {
        clearTimeout(bufferTimeout);
        bufferTimeout = null;
    }
}

function bufferHasAllColumns(): boolean {
    if (!initialized || !columns?.length || !buffer?.length) return false;
    return (
        buffer.length === columns.length &&
        buffer.every((v) => typeof v === 'number' && !isNaN(v))
    );
}

function resetBuffer() {
    if (!initialized || !columns?.length) return;
    buffer = new Array(columns.length).fill(NaN);
}

function flushBuffer() {
    if (!initialized || !columns?.length || !buffer?.length) return;

    const hasData = buffer.some((v) => typeof v === 'number' && !isNaN(v));
    if (!hasData) return;

    const lineToWrite = [getTimestamp(), ...buffer];
    onPlotData.fire(lineToWrite);

    resetBuffer();
    bufferTimeout = null;
}

export async function parsePlotCommand(line: string) {
    if (!line.startsWith(PLOT_COMMAND_PREFIX)) return;
    const line1 = line.substring(PLOT_COMMAND_PREFIX.length).trim();

    // start command with column definitions
    const defMatch = /^start (.+)$/.exec(line1);
    if (defMatch) {
        columns = defMatch[1].split(',').map((v) => v.trim());
        startTime = Date.now();
        const columnsToWrite = getDatalogColumns();

        initialized = true;
        resetBuffer();
        onPlotStarted.fire(columnsToWrite);
        return;
    }

    // end command
    if (/^end$/.test(line1)) {
        flushBuffer();
        await closeLogFile();
        return;
    }

    if (!initialized || !columns?.length || !buffer?.length) return;
    let values: number[] = [];
    // sensor:value pairs, allowing missing values (e.g. "a:1, b:, c:3")
    if (/^([\w]+:\s*([-+]?\d*\.?\d+)?\s*[, ]*)+$/.test(line1)) {
        const matches = Array.from(line1.matchAll(/([\w]+):\s*([-+]?\d*\.?\d+)?/g));
        values = columns.map((col) => {
            const m = matches.find((match) => match[1] === col);
            return m && m[2] !== undefined ? parseFloat(m[2]) : NaN;
        });
    }

    // comma separated values, allowing missing values (e.g. "1, ,3" or "1,,3" or "1,2" or ",2,3")
    else if (/^(([-+]?\d*\.?\d+)?\s*,?\s*)+$/.test(line1)) {
        // Split by comma, trim whitespace, and parse numbers or NaN for missing
        values = line1.split(',').map((v) => {
            const num = v.trim();
            return num ? Number(num) : NaN;
        });
    }

    // check if any values are overlapping
    for (let i = 0; i < columns.length; i++) {
        if (!isNaN(values[i]) && !isNaN(buffer[i])) {
            // overlapping value, flush buffers
            flushBuffer();
            break;
        }
    }

    // merge values to buffer
    for (let i = 0; i < Math.min(values.length, columns.length); i++) {
        if (typeof values[i] === 'number' && !isNaN(values[i])) {
            buffer[i] = values[i];
        }
    }

    // check if buffer is full
    if (bufferHasAllColumns()) {
        flushBuffer();
    } else if (bufferTimeout === null) {
        bufferTimeout = setTimeout(() => {
            flushBuffer();
        }, BUFFER_FLUSH_TIMEOUT);
    }
}

export function resetPlotParser() {
    closeLogFile();
    columns = undefined;
    buffer = undefined;
    startTime = 0;
    if (bufferTimeout) {
        clearTimeout(bufferTimeout);
        bufferTimeout = null;
    }
}

export function registerStdoutPlotHelper(onCreateCb?: (path: string) => void) {
    onPlotStarted.event((columns) => {
        // write header to file
        if (!Config.plotAutosave) return;
        openLogFile();
        if (logFile) {
            logFile.write(columns.join(',') + '\n');
            if (onCreateCb) onCreateCb(logFile.path as string);
        }
    });
    onPlotData.event((data) => {
        // write to file
        if (logFile) {
            logFile.write(
                data
                    .map((v) =>
                        typeof v === 'number' && !isNaN(v) ? v.toString() : '',
                    )
                    .join(',') + '\n',
            );
        }
    });

    onPlotStarted.event((columns) => {
        // send to webview
        DatalogView.Instance?.setHeaders(columns, undefined);
    });
    onPlotData.event((data) => {
        // send to webview
        DatalogView.Instance?.addData(
            data.map((v) => (typeof v === 'number' ? v : NaN)),
        );
    });
}
