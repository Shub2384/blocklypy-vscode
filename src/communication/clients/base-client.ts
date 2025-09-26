import { DeviceMetadata } from '..';
import { logDebug, logDebugFromHub } from '../../extension/debug-channel';
import { clearPythonErrors } from '../../extension/diagnostics';
import { handleStdOutDataHelpers } from '../../logic/stdout-helper';
import Config, { ConfigKeys } from '../../utils/config';
import { BaseLayer } from '../layers/base-layer';

export abstract class BaseClient {
    static readonly devtype: string;
    static readonly devname: string;
    static readonly supportsModularMpy: boolean;

    protected _exitStack: (() => Promise<void> | void)[] = [];
    private _stdoutBuffer: string = '';
    private _stdoutTimer: NodeJS.Timeout | undefined = undefined;

    constructor(
        protected _metadata: DeviceMetadata | undefined,
        protected parent: BaseLayer,
    ) {}

    public get devtype(): string {
        return (this.constructor as typeof BaseClient).devtype;
    }

    public get supportsModularMpy() {
        return (this.constructor as typeof BaseClient).supportsModularMpy;
    }

    public get metadata() {
        return this._metadata;
    }

    public get name(): string | undefined {
        return this._metadata?.name;
    }

    public get id(): string | undefined {
        return this._metadata?.id;
    }

    public abstract get description(): string | undefined;

    public abstract get connected(): boolean;

    public abstract write(data: Uint8Array, withoutResponse: boolean): Promise<void>;

    public async disconnect(): Promise<void> {
        try {
            console.log('Disconnecting...');
            await this.runExitStack();
            await this.disconnectWorker();
        } catch (error) {
            logDebug(`Error during disconnect: ${String(error)}`);
        }
    }

    protected async disconnectWorker(): Promise<void> {
        // Override in subclass if needed
        return Promise.resolve();
    }

    protected async handleDisconnectAsync(id: string) {
        logDebug(`Disconnected from ${id}`);
        clearPythonErrors();
        // Do not call disconnectAsync recursively
        await this.runExitStack();
        this._metadata = undefined;

        // notify parent layer
        this.parent.removeClient(this);
    }

    public async connect(
        onDeviceUpdated: (device: DeviceMetadata) => void | undefined,
        onFinalizing: (device: DeviceMetadata) => void | undefined,
    ): Promise<void> {
        try {
            await this.runExitStack();

            await this.connectWorker(onDeviceUpdated, onFinalizing);

            if (!this.name) throw new Error('Failed to get device name');

            logDebug(`Connected to ${this.name}, ${this.description}`);

            await Config.setConfigValue(ConfigKeys.DeviceLastConnected, this.id);
        } catch (error) {
            await this.disconnect();
            this._metadata = undefined;
            throw error;
        }
    }

    protected abstract connectWorker(
        onDeviceUpdated: (device: DeviceMetadata) => void | undefined,
        onFinalizing: (device: DeviceMetadata) => void | undefined,
    ): Promise<void>;

    protected async runExitStack() {
        for (const fn of this._exitStack) {
            try {
                await fn();
            } catch (error) {
                logDebug(`Error during cleanup function : ${String(error)}`);
            }
        }
        this._exitStack = [];
    }

    protected abstract handleIncomingDataAsync(data: Buffer): Promise<void>;

    protected async processStdoutData() {
        if (this._stdoutBuffer.length > 0) {
            await handleStdOutDataHelpers(this._stdoutBuffer);
            this._stdoutBuffer = '';
        }
        if (this._stdoutTimer) {
            clearTimeout(this._stdoutTimer);
            this._stdoutTimer = undefined;
        }
    }

    protected async handleWriteStdout(text: string) {
        logDebugFromHub(text, false);

        this._stdoutBuffer += text;

        // Flush after every newline
        let newlineIndex;
        while ((newlineIndex = this._stdoutBuffer.indexOf('\n')) !== -1) {
            const line = this._stdoutBuffer.slice(0, newlineIndex + 1);
            await handleStdOutDataHelpers(line);
            this._stdoutBuffer = this._stdoutBuffer.slice(newlineIndex + 1);
        }

        // Set/reset 500ms timeout for any remaining partial line
        if (this._stdoutTimer) clearTimeout(this._stdoutTimer);
        if (this._stdoutBuffer.length > 0) {
            this._stdoutTimer = setTimeout(() => {
                void this.processStdoutData().then(() => {
                    this._stdoutTimer = undefined;
                });
            }, 500);
        }
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public async sendTerminalUserInputAsync(_text: string): Promise<void> {
        // Override in subclass if needed
        throw new Error('sendTerminalUserInput not implemented');
    }

    public async action_start(_slot?: number) {}

    public async action_stop() {}

    public async action_upload(_data: Uint8Array, _slot?: number, _filename?: string) {}
}
