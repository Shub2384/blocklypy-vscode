import { ResponseMessage } from './base-message';

export interface InfoResponse {
    messageType: number;
    rpcMajor: number;
    rpcMinor: number;
    rpcBuild: number;
    fwMajor: number;
    fwMinor: number;
    fwBuild: number;
    maxPacketSize: number;
    maxMessageSize: number;
    maxChunkSize: number;
    productGroupDeviceType: number;
}

// export enum ProductGroupDeviceType {
//     SpikePrime = 0,
//     SpikeEssential = 1,
//     SpikePrimeH5 = 2,
// }
export const ProductGroupDeviceTypeMap: Record<number, string> = {
    [0]: 'Spike Prime',
    [1]: 'Spike Essential',
    [2]: 'Spike Prime H5',
};

export class InfoResponseMessage extends ResponseMessage {
    public static readonly Id = 0x01;

    constructor(public info: InfoResponse) {
        super();
    }

    public static fromBytes(data: Uint8Array): InfoResponseMessage {
        if (data[0] !== InfoResponseMessage.Id) {
            throw new Error('Invalid InfoResponseMessage');
        }
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        const info: InfoResponse = {
            messageType: view.getUint8(0),
            rpcMajor: view.getUint8(1),
            rpcMinor: view.getUint8(2),
            rpcBuild: view.getUint16(3, true),
            fwMajor: view.getUint8(5),
            fwMinor: view.getUint8(6),
            fwBuild: view.getUint16(7, true),
            maxPacketSize: view.getUint16(9, true),
            maxMessageSize: view.getUint16(11, true),
            maxChunkSize: view.getUint16(13, true),
            productGroupDeviceType: view.getUint16(15, true),
        };
        return new InfoResponseMessage(info);
    }
}
