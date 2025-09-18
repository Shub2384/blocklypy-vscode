import { Peripheral } from '@abandonware/noble';
import { PybricksDecodedBleBroadcast } from '../pybricks/protocol-ble-broadcast';

export interface DeviceMetadata {
    devtype: string;
    peripheral: Peripheral;
    lastBroadcast?: PybricksDecodedBleBroadcast;
}

export enum ConnectionStatus {
    Disconnected = 'disconnected',
    Connecting = 'connecting',
    Connected = 'connected',
    Disconnecting = 'disconnecting',
}
