import * as vscode from 'vscode';
import { DeviceMetadata } from '../communication';
import { EXTENSION_KEY } from '../const';

// const CONFIG_BASEKEY = EXTENSION_KEY + '.';
export const enum ConfigKeys {
    DeviceLastConnected = 'lastconnected-device',
    DeviceAutoConnect = 'autoconnect-device',
    ProgramAutoStart = 'autostart-program',
    TerminalAutoClear = 'autoclear-terminal',
    PlotAutosave = 'autosave-plot',
    ConnectionTimeout = 'connection-timeout',
    DeviceVisibilityTimeout = 'device-visibility-timeout',
}

export function getConfig<T>(key: string) {
    // use the extension section so keys are the short names from ConfigKeys
    return vscode.workspace.getConfiguration(EXTENSION_KEY).get<T>(key);
}

export async function updateConfig(key: string, value: unknown) {
    await vscode.workspace
        .getConfiguration(EXTENSION_KEY)
        .update(key, value, vscode.ConfigurationTarget.Global);
}

class Config {
    private static read<T>(key: ConfigKeys, defaultValue?: T): T {
        const value = getConfig<T>(key);
        if (value === undefined && defaultValue !== undefined) {
            return defaultValue;
        }
        return value as T;
    }
    private static async write(key: ConfigKeys, value: unknown) {
        await updateConfig(key, value);
    }
    public static getKey(key: ConfigKeys) {
        return `${EXTENSION_KEY}.${key}`;
    }

    // helper for toggling boolean flags
    private static async toggleBoolean(key: ConfigKeys, value?: boolean) {
        const current = this.read<boolean>(key) ?? false;
        const next = value === undefined ? !current : value;
        await this.write(key, next);
        return next;
    }

    public static get deviceLastConnected(): string | undefined {
        return this.read<string>(ConfigKeys.DeviceLastConnected);
    }
    public static get programAutostart(): boolean {
        return !!this.read<boolean>(ConfigKeys.ProgramAutoStart);
    }
    public static get terminalAutoClear(): boolean {
        return !!this.read<boolean>(ConfigKeys.TerminalAutoClear);
    }
    public static get deviceAutoConnect(): boolean {
        return !!this.read<boolean>(ConfigKeys.DeviceAutoConnect);
    }
    public static get plotAutosave(): boolean {
        return !!this.read<boolean>(ConfigKeys.PlotAutosave);
    }

    public static getConfigValue<T>(key: ConfigKeys, defaultValue?: T) {
        return this.read<T>(key, defaultValue);
    }
    public static async setConfigValue(key: ConfigKeys, value: unknown) {
        await this.write(key, value);
    }
    public static toggleConfigValue(key: ConfigKeys, value?: boolean) {
        return this.toggleBoolean(key, value);
    }

    public static encodeDeviceKey(name: string, devtype: string) {
        DeviceMetadata.generateId(name, devtype);
    }
    public static decodeDeviceKey(value: string) {
        const [devtype, name] = value ? value.split(/:(.+)/).slice(0, 2) : [];
        return { name, devtype };
    }
}
export default Config;
