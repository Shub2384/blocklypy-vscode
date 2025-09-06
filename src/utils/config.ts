import * as vscode from 'vscode';
import { EXTENSION_KEY } from '../const';

const CONFIG_BASEKEY = EXTENSION_KEY + '.';
const enum ConfigKeys {
    LastConnectedDevice = 'lastConnectedDevice',
    EnableAutoConnect = 'autoConnect',
    EnableAutostart = 'autoStart',
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
    public static get enableAutoConnect() {
        return this.read(ConfigKeys.EnableAutoConnect);
    }
    public static async setEnableAutoConnect(value: boolean) {
        await this.write(ConfigKeys.EnableAutoConnect, value);
    }
    public static get enableAutostart() {
        return this.read(ConfigKeys.EnableAutostart);
    }
    public static async setEnableAutostart(value: boolean) {
        await this.write(ConfigKeys.EnableAutostart, value);
    }
}
export default Config;
