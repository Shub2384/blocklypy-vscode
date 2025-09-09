import * as vscode from 'vscode';
import { EXTENSION_KEY } from '../const';

const CONFIG_BASEKEY = EXTENSION_KEY + '.';
const enum ConfigKeys {
    LastConnectedDevice = 'lastConnectedDevice',
    AutoConnect = 'autoConnect',
    AutoStartProgram = 'autoStart',
    AutoClearTerminal = 'autoClearTerminal',
}

export function getConfig<T>(key: string) {
    return vscode.workspace.getConfiguration().get(key) as T;
}

export async function updateConfig(key: string, value: any) {
    const res = await vscode.workspace
        .getConfiguration()
        .update(key, value, vscode.ConfigurationTarget.Global);
}

class Config {
    private static read(key: ConfigKeys) {
        return getConfig<any>(CONFIG_BASEKEY + key);
    }
    private static async write(key: ConfigKeys, value: any) {
        await updateConfig(Config.getKey(key), value);
    }
    public static getKey(key: ConfigKeys) {
        return CONFIG_BASEKEY + key;
    }
    public static get lastConnectedDevice() {
        return this.read(ConfigKeys.LastConnectedDevice);
    }
    public static async setLastConnectedDevice(value: string) {
        await this.write(ConfigKeys.LastConnectedDevice, value);
    }
    public static get autoConnect() {
        return this.read(ConfigKeys.AutoConnect);
    }
    public static async setAutoConnect(value: boolean) {
        await this.write(ConfigKeys.AutoConnect, value);
    }
    public static get autostart() {
        return this.read(ConfigKeys.AutoStartProgram);
    }
    public static async setAutostart(value: boolean) {
        await this.write(ConfigKeys.AutoStartProgram, value);
    }
    public static get autoClearTerminal() {
        return this.read(ConfigKeys.AutoClearTerminal);
    }
    public static async setAutoClearTerminal(value: boolean) {
        await this.write(ConfigKeys.AutoClearTerminal, value);
    }
}
export default Config;
