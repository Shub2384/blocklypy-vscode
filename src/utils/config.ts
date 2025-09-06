import * as vscode from 'vscode';

const CONFIG_BASEKEY = 'pybricks.';
const CONFIG_LASTCONNECTEDDEVICE = 'lastConnectedDevice';
const CONFIG_ENABLE_AUTOCONNECT = 'autoConnect';
const CONFIG_ENABLE_AUTOSTART = 'autoStart';

export function getConfig<T>(key: string) {
    return vscode.workspace.getConfiguration().get(key) as T;
}

export async function updateConfig(key: string, value: any) {
    const res = await vscode.workspace
        .getConfiguration()
        .update(key, value, vscode.ConfigurationTarget.Global);
}

class Config {
    private read(key: string) {
        return getConfig<any>(CONFIG_BASEKEY + key);
    }
    private async write(key: string, value: any) {
        await updateConfig(CONFIG_BASEKEY + key, value);
    }
    public get lastConnectedDevice() {
        return this.read(CONFIG_LASTCONNECTEDDEVICE);
    }
    public async setLastConnectedDevice(value: string) {
        await this.write(CONFIG_LASTCONNECTEDDEVICE, value);
    }
    public get enableAutoConnect() {
        return this.read(CONFIG_ENABLE_AUTOCONNECT);
    }
    public async setEnableAutoConnect(value: boolean) {
        await this.write(CONFIG_ENABLE_AUTOCONNECT, value);
    }
    public get enableAutostart() {
        return this.read(CONFIG_ENABLE_AUTOSTART);
    }
    public async setEnableAutostart(value: boolean) {
        await this.write(CONFIG_ENABLE_AUTOSTART, value);
    }
}
const config = new Config();
export default config;
