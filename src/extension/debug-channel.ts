import * as vscode from 'vscode';
import { hasState, StateProp } from '../logic/state';
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
                { light: 'asset/icon-light.svg', dark: 'asset/icon-dark.svg' },
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

    open(initialDimensions: vscode.TerminalDimensions | undefined): void {
        // NOOP
    }

    close(): void {
        this.closeEmitter.fire();
    }

    handleInput(data: string) {
        if (!this.onUserInput) return; // ignore input if no callback is set, this is how we send to the BLE device
        if (!hasState(StateProp.Running)) return; // ignore input if user program is not not running

        this.onUserInput(data); // send to BLE device
        this.write(data, true);
    }

    setCloseCallback(cb: () => void) {
        this.closeCallback = cb;
    }

    public show() {
        this.terminal?.show();
    }

    public handleHubOutput(message: string, addNewLine = true) {
        this.write(message + (addNewLine ? '\r\n' : ''), false);
    }

    private write(message: string, userinput?: boolean) {
        // this.hideInputIndicator();
        message = message.replace(/\r\n?/g, '\r\n');

        const nocolor = userinput === undefined || message === '\r\n';
        const color = nocolor ? '' : userinput ? '\x1b[32m' : '\x1b[36m'; // green for user, cyan for hub
        const reset = nocolor ? '' : '\x1b[0m';

        console.warn('write:', message);
        this.writeEmitter.fire(color + message + reset);
    }
}

export function registerDebugTerminal(
    context: vscode.ExtensionContext,
    onUserInput?: (input: string) => void,
) {
    debugTerminal = new DebugTerminal(context);
    debugTerminal.onUserInput = onUserInput;
    debugTerminal.show();
    // vscode.window.activeTerminal = debugTerminal.terminal;

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
    debugTerminal?.handleHubOutput('\x1bc', false); // ANSI escape code to clear terminal
}

export function logDebug(message: string, linebreak = true, show: boolean = true) {
    if (debugTerminal) {
        if (show) debugTerminal.show();
        debugTerminal.handleHubOutput(message, linebreak);
    }
}

let debugTerminal: DebugTerminal | undefined;
