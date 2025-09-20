import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'vscode';
import Config from '../utils/config';
import { getActiveFileFolder } from '../utils/files';
import { DatalogView } from '../views/DatalogView';

export const BUFFER_FLUSH_TIMEOUT = 1000; // ms

export class PlotManager {
    private initialized = false;
    private logFile: fs.WriteStream | null = null;
    private startTime: number = 0;
    private columns: string[] | undefined = undefined;
    private buffer: number[] | undefined = undefined;
    private bufferTimeout: NodeJS.Timeout | null = null;

    public readonly onPlotStarted = new EventEmitter<string[]>();
    public readonly onPlotData = new EventEmitter<number[]>();

    public static createWithCb(onCreateCb?: (path: string) => void): PlotManager {
        const pm = new PlotManager();
        pm.onPlotStarted.event((columns: string[]) => {
            // write header to file
            if (!Config.plotAutosave) return;
            pm.openLogFile();
            if (pm.logFile) {
                pm.logFile.write(columns.join(',') + '\n');
                if (onCreateCb) onCreateCb(pm.logFile.path as string);
            }
        });
        pm.onPlotData.event((data: number[]) => {
            // write to file
            if (pm.logFile) {
                pm.logFile.write(
                    data
                        .map((v) =>
                            typeof v === 'number' && !isNaN(v) ? v.toString() : '',
                        )
                        .join(',') + '\n',
                );
            }
        });

        pm.onPlotStarted.event((columns: string[]) => {
            // send to webview
            DatalogView.Instance?.setHeaders(columns, undefined);
        });
        pm.onPlotData.event((data) => {
            // send to webview
            DatalogView.Instance?.addData(
                data.map((v) => (typeof v === 'number' ? v : NaN)),
            );
        });

        return pm;
    }

    private get delta(): number {
        const now = Date.now();
        const seconds = ((now - this.startTime) / 1000).toFixed(3);
        return Number(seconds);
    }

    public get datalogcolumns(): string[] {
        return ['timestamp', ...(this.columns ?? [])];
    }

    public get data(): number[][] {
        return this.buffer ? [this.buffer] : [];
    }

    private openLogFile() {
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
        this.logFile = fs.createWriteStream(filePath, { flags: 'w', flush: true });
    }

    public async closeLogFile() {
        if (this.logFile) {
            await new Promise<void>((resolve, reject) => {
                this.logFile!.end(() => {
                    this.logFile = null;
                    resolve();
                });
                this.logFile!.on('error', reject);
            });
        }
        this.columns = undefined;
        this.buffer = undefined;
        this.startTime = 0;
        if (this.bufferTimeout) {
            clearTimeout(this.bufferTimeout);
            this.bufferTimeout = null;
        }
    }

    public get bufferComplete(): boolean {
        if (!this.initialized || !this.columns?.length || !this.buffer?.length)
            return false;
        return (
            this.buffer.length === this.columns.length &&
            this.buffer.every((v) => typeof v === 'number' && !isNaN(v))
        );
    }

    private resetBuffer() {
        if (!this.initialized || !this.columns?.length) return;
        this.buffer = new Array(this.columns.length).fill(NaN);
    }

    private flushBuffer() {
        if (!this.initialized || !this.columns?.length || !this.buffer?.length) return;

        const hasData = this.buffer.some((v) => typeof v === 'number' && !isNaN(v));
        if (!hasData) return;

        const lineToWrite = [this.delta, ...this.buffer];
        this.onPlotData.fire(lineToWrite);

        this.resetBuffer();
        this.bufferTimeout = null;
    }

    public resetPlotParser() {
        this.closeLogFile();
        this.columns = undefined;
        this.buffer = undefined;
        this.startTime = 0;
        if (this.bufferTimeout) {
            clearTimeout(this.bufferTimeout);
            this.bufferTimeout = null;
        }
    }

    public start(columns_: string[]) {
        this.startTime = Date.now();
        this.columns = columns_;

        this.initialized = true;
        this.resetBuffer();
        this.onPlotStarted.fire(this.datalogcolumns);
    }

    public async stop() {
        this.flushBuffer();
        await this.closeLogFile();
    }

    public flushPlotBuffer() {
        this.flushBuffer();
    }

    public get running(): boolean {
        return this.initialized && !!this.columns?.length && !!this.buffer?.length;
    }

    public getColumns(): string[] {
        return this.columns || [];
    }

    public getBufferAt(index: number): number {
        if (!this.initialized || !this.columns?.length || !this.buffer?.length)
            return Number.NaN;
        if (index < 0 || index >= this.buffer.length) return Number.NaN;
        return this.buffer[index];
    }

    public setBufferAt(index: number, value: number) {
        if (!this.initialized || !this.columns?.length || !this.buffer?.length) return;
        if (index < 0 || index >= this.buffer.length) return;
        this.buffer[index] = value;
    }

    public processPostDataReceived() {
        if (!this.initialized || !this.columns?.length || !this.buffer?.length)
            return false;
        if (this.bufferComplete) {
            this.flushPlotBuffer();
        } else if (this.bufferTimeout === null) {
            this.bufferTimeout = setTimeout(() => {
                this.flushBuffer();
            }, BUFFER_FLUSH_TIMEOUT);
        }
    }
}
