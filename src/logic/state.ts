import * as vscode from 'vscode';

export enum StateProp {
    Scanning = 'scanning',
    Connecting = 'connecting',
    Connected = 'connected',
    Uploading = 'uploading',
    Compiling = 'compiling',
    Running = 'running',
}

export type StateChangeEvent = {
    prop: StateProp;
    value: boolean;
};

const stateChangeEmitter = new vscode.EventEmitter<StateChangeEvent>();
export const onStateChange = stateChangeEmitter.event;
const state: Record<StateProp, boolean> = Object.fromEntries(
    Object.values(StateProp).map((prop) => [prop, false]),
) as Record<StateProp, boolean>;

export function withState(stateProp: StateProp, fn: Function) {
    return withComplexState({ yes: [stateProp] }, fn);
}
export function withStateNot(stateProp: StateProp, fn: Function) {
    return withComplexState({ not: [stateProp] }, fn);
}

export function withComplexState(
    { yes = [], not = [] }: { yes?: StateProp[]; not?: StateProp[] },
    fn: Function,
) {
    return async (...args: any[]) => {
        // Check required true states
        if (yes.some((prop) => !state[prop])) return;
        // Check required false states
        if (not.some((prop) => state[prop])) return;

        // Mark all yes as busy
        yes.forEach((prop) => (state[prop] = true));
        try {
            await fn(...args);
        } finally {
            yes.forEach((prop) => (state[prop] = false));
        }
    };
}

export function hasState(stateProp: StateProp) {
    return state[stateProp];
}

export function setState(stateProp: StateProp, value: boolean) {
    if (state[stateProp] !== value) {
        state[stateProp] = value;
        stateChangeEmitter.fire({ prop: stateProp, value });
    }
}
