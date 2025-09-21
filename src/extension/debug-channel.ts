import * as vscode from 'vscode';
import { hasState, StateProp } from '../logic/state';
import { registerStdoutHelper } from '../logic/stdout-helper';
import { getIcon } from './utils';

class DebugTerminal implements vscode.Pseudoterminal {
    terminal: vscode.Terminal;
    onUserInput?: (input: string) => void;
    private closeCallback?: () => void;
    private readonly writeEmitter = new vscode.EventEmitter<string>();
    readonly onDidWrite: vscode.Event<string> = this.writeEmitter.event;
    private readonly closeEmitter = new vscode.EventEmitter<void>();
    readonly onDidClose: vscode.Event<void> = this.closeEmitter.event;

    constructor(private context: vscode.ExtensionContext) {
        this.terminal = vscode.window.createTerminal({
            name: 'BlocklyPy Debug Terminal',
            pty: this,
            iconPath: getIcon(
                {
                    light: 'asset/icons/icon-light.svg',
                    dark: 'asset/icons/icon-dark.svg',
                },
                this.context,
            ),
            isTransient: false,
        } as vscode.ExtensionTerminalOptions);

        vscode.window.onDidCloseTerminal((closedTerminal) => {
            if (closedTerminal === this.terminal && this.closeCallback) {
                this.closeCallback();
            }
        });
    }

    open(_initialDimensions: vscode.TerminalDimensions | undefined): void {
        // NOOP
    }

    close(): void {
        this.closeEmitter.fire();
    }

    public handleInput(data: string) {
        // built-in name, do not change the name
        this.handleInputFromTerminal(data);
    }
    handleInputFromTerminal(data: string) {
        if (!this.onUserInput) return; // ignore input if no callback is set, this is how we send to the BLE device
        if (!hasState(StateProp.Running)) return; // ignore input if user program is not not running

        this.onUserInput(data); // send to BLE device
        this.write(data, '\x1b[32m' /* green */);
    }

    public handleDataFromHubOutput(message: string, addNewLine = true) {
        this.write(message + (addNewLine ? '\r\n' : ''), '\x1b[36m');
    }
    public handleDataFromExtension(message: string) {
        this.write(message + '\r\n', undefined);
    }

    setCloseCallback(cb: () => void) {
        this.closeCallback = cb;
    }

    public show(preserveFocus?: boolean) {
        this.terminal?.show(preserveFocus);
    }

    private write(message: string, color: string | undefined) {
        // this.hideInputIndicator();
        message = message.replace(/\r\n?/g, '\r\n');
        const isempty = message === '\r\n' || message.trim() === '';

        this.writeEmitter.fire(
            (color && !isempty ? color : '') +
                message +
                (color && !isempty ? '\x1b[0m' : ''),
        );
    }
}

export function registerDebugTerminal(
    context: vscode.ExtensionContext,
    onUserInput?: (input: string) => void,
) {
    // create terminal
    debugTerminal = new DebugTerminal(context);
    debugTerminal.onUserInput = onUserInput;
    debugTerminal.show(false);
    // vscode.window.activeTerminal = debugTerminal.terminal;

    // register stdout helpers
    registerStdoutHelper();

    // Return a disposable that closes the terminal when disposed
    context.subscriptions.push({
        dispose: () => {
            if (debugTerminal) debugTerminal.onUserInput = undefined;
            debugTerminal?.close();
            debugTerminal = undefined;
        },
    });
}

export function clearDebugLog() {
    // TODO
    debugTerminal?.handleDataFromHubOutput('\x1bc', false); // ANSI escape code to clear terminal
}

export function logDebug(message: string, show: boolean = false) {
    if (!debugTerminal) return;
    if (show) debugTerminal.show(false);
    debugTerminal.handleDataFromExtension(message);
}

export function logDebugFromHub(message: string, linebreak = true) {
    if (!debugTerminal) return;
    debugTerminal.handleDataFromHubOutput(message, linebreak);
}

let debugTerminal: DebugTerminal | undefined;
