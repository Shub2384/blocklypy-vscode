import { DeviceMetadata } from '..';
import {
    RequestMessage,
    ResponseMessage,
} from '../../spike/spike-messages/base-message';
import { ProductGroupDeviceTypeMap } from '../../spike/spike-messages/info-response-message';
import { HubOSHandler } from '../common/hubos-handler';
import { BaseLayer } from '../layers/base-layer';
import { BaseClient } from './base-client';

export abstract class HubOSBaseClient extends BaseClient {
    protected _hubOSHandler: HubOSHandler | undefined;

    public get descriptionKVP(): [string, string][] {
        const retval: [string, string][] = [];
        const devname = (this.constructor as typeof HubOSBaseClient).devname;
        if (devname) retval.push(['devname', devname]);

        const capabilities = this._hubOSHandler?.capabilities;
        if (!capabilities) return retval;

        const hubType = ProductGroupDeviceTypeMap[capabilities.productGroupDeviceType];
        if (hubType) retval.push(['hubType', hubType]);
        const { rpcMajor, rpcMinor, rpcBuild, fwMajor, fwMinor, fwBuild } =
            capabilities;
        retval.push(['firmware', `${fwMajor}.${fwMinor}.${fwBuild}`]);
        retval.push(['software', `${rpcMajor}.${rpcMinor}.${rpcBuild}`]);
        if (this.uniqueSerial) retval.push(['serial', this.uniqueSerial]);

        return retval;
    }

    constructor(_metadata: DeviceMetadata | undefined, parent: BaseLayer) {
        super(_metadata, parent);
        this._hubOSHandler = new HubOSHandler(
            (data: Uint8Array) => this.write(data, true),
            (text) => this.handleWriteStdout(text),
        );
    }
    protected async sendMessage<TResponse extends ResponseMessage>(
        message: RequestMessage,
    ): Promise<TResponse | undefined> {
        return this._hubOSHandler?.sendMessage<TResponse>(message);
    }

    protected async handleIncomingDataAsync(data: Buffer) {
        await this._hubOSHandler?.handleIncomingDataAsync(data);
    }

    public async action_start(slot?: number) {
        await this._hubOSHandler?.action_start(slot);
    }

    public async action_stop() {
        await this._hubOSHandler?.action_stop();
    }

    public async action_upload(
        data: Uint8Array,
        slot_input?: number,
        filename?: string,
    ) {
        await this._hubOSHandler?.action_upload(data, slot_input, filename);
    }

    public async action_clear_all_slots() {
        await this._hubOSHandler?.action_clear_all_slots();
    }
}
