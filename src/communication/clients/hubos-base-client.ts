import { DeviceMetadata } from '..';
import {
    RequestMessage,
    ResponseMessage,
} from '../../spike/spike-messages/base-message';
import { HubOSHandler } from '../common/hubos-handler';
import { BaseLayer } from '../layers/base-layer';
import { BaseClient } from './base-client';

export abstract class HubOSBaseClient extends BaseClient {
    protected _hubOSHandler: HubOSHandler | undefined;

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
