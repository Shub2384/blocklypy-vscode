import { DeviceMetadata } from '.';
import { logDebug, logDebugFromHub } from '../extension/debug-channel';
import { handleStdOutData } from '../logic/stdout-helper';
import Config, { ConfigKeys } from '../utils/config';

export abstract class BaseClient {
    static readonly devtype: string;
    static readonly devname: string;
    static readonly supportsModularMpy: boolean;

    protected _device: DeviceMetadata | undefined;
    protected _exitStack: (() => Promise<void>)[] = [];
    private _stdoutBuffer: string = '';
    private _stdoutTimer: NodeJS.Timeout | undefined = undefined;

    public get devtype(): string {
        return (this.constructor as typeof BaseClient).devtype;
    }

    public get supportsModularMpy() {
        return (this.constructor as typeof BaseClient).supportsModularMpy;
    }

    public abstract get name(): string | undefined;

    public abstract get connected(): boolean;

    public abstract write(data: Uint8Array, withoutResponse: boolean): Promise<void>;

    public abstract disconnect(): Promise<void>;

    public async connect(
        device: DeviceMetadata,
        onDeviceUpdated: (device: DeviceMetadata) => void,
        onFinalizing: (device: DeviceMetadata, name?: string) => void,
    ): Promise<void> {
        try {
            this.runExitStack();
            this._device = device;

            await this.connectWorker(device, onDeviceUpdated, onFinalizing);

            logDebug(`Connected to ${this.name}`);
            const connectedName = this.name;
            await Config.setConfigValue(ConfigKeys.DeviceLastConnected, this.name);
        } catch (error) {
            this._device = undefined;
            throw error;
        }
    }

    protected abstract connectWorker(
        device: DeviceMetadata,
        onDeviceUpdated: (device: DeviceMetadata) => void,
        onFinalizing: (device: DeviceMetadata, name?: string) => void,
    ): Promise<void>;

    protected async runExitStack() {
        for (const fn of this._exitStack) {
            try {
                await fn();
            } catch (error) {
                logDebug(`Error during cleanup function : ${error}`);
            }
        }
    }

    protected abstract handleIncomingData(data: Buffer): void;

    protected async processStdoutData() {
        if (this._stdoutBuffer.length > 0) {
            await handleStdOutData(this._stdoutBuffer);
            this._stdoutBuffer = '';
        }
        if (this._stdoutTimer) {
            clearTimeout(this._stdoutTimer);
            this._stdoutTimer = undefined;
        }
    }

    protected handleWriteStdout(text: string) {
        logDebugFromHub(text, false);

        this._stdoutBuffer += text;

        // Flush after every newline
        let newlineIndex;
        while ((newlineIndex = this._stdoutBuffer.indexOf('\n')) !== -1) {
            const line = this._stdoutBuffer.slice(0, newlineIndex + 1);
            handleStdOutData(line);
            this._stdoutBuffer = this._stdoutBuffer.slice(newlineIndex + 1);
        }

        // Set/reset 500ms timeout for any remaining partial line
        if (this._stdoutTimer) clearTimeout(this._stdoutTimer);
        if (this._stdoutBuffer.length > 0) {
            this._stdoutTimer = setTimeout(() => {
                this.processStdoutData();
                this._stdoutTimer = undefined;
            }, 500);
        }
    }

    public sendTerminalUserInput(text: string): void {
        // Override in subclass if needed
        throw new Error('sendTerminalUserInput not implemented');
    }

    public async action_start(slot?: number) {}

    public async action_stop() {}

    public async action_upload(data: Uint8Array, slot?: number, filename?: string) {}
}
