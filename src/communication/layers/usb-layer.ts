import { PortInfo } from '@serialport/bindings-interface';
import { DelimiterParser, SerialPort } from 'serialport';
import { usb } from 'usb';
import { DeviceMetadata } from '..';
import {
    SPIKE_USB_PRODUCT_ID,
    SPIKE_USB_PRODUCT_ID_NUM,
    SPIKE_USB_VENDOR_ID,
    SPIKE_USB_VENDOR_ID_NUM,
} from '../../spike/protocol';
import { HubOSUsbClient } from '../clients/hubos-usb-client';
import { BaseLayer } from './base-layer';

export class DeviceMetadataForUSB extends DeviceMetadata {
    private _resolvedName: string | undefined = undefined;
    constructor(
        public devtype: string,
        public portinfo: PortInfo,
        public serialNumber: string,
    ) {
        super(devtype);
    }

    public get rssi(): number | undefined {
        return undefined;
    }

    public get name(): string | undefined {
        return this._resolvedName ?? this.portinfo.path;
    }

    public set name(_value: string | undefined) {
        this._resolvedName = _value;
    }

    public get id(): string {
        return DeviceMetadata.generateId(this.devtype, this.portinfo.path);
    }
}

export class USBLayer extends BaseLayer {
    private _parser?: DelimiterParser;

    public supportsDevtype(_devtype: string) {
        return HubOSUsbClient.devtype === _devtype;
    }

    constructor() {
        super();
    }

    private usbRegistrySerial = new Map<usb.Device, string>();
    public async startup() {
        await super.startup();

        // setInterval(() => void this.scan().catch(console.error), 10000);

        usb.on('attach', (device) => {
            // console.log('USB Device attached:', device);
            if (
                device.deviceDescriptor.idVendor === SPIKE_USB_VENDOR_ID_NUM &&
                device.deviceDescriptor.idProduct === SPIKE_USB_PRODUCT_ID_NUM
                // pybricks = VID:164, PID:16
            ) {
                const handleOpen = async (device: usb.Device) => {
                    device.open();
                    // const manufacturer = await _getUsbStringDescriptor(device, 1); // 1 = Manufacturer, LEGO System A/S
                    // const product = await _getUsbStringDescriptor(device, 2); // 2 = Product, SPIKE Prime VCP
                    const serialnumber = await _getUsbStringDescriptor(device, 3); // 3 = Serial Number, 000000000000
                    if (serialnumber) this.usbRegistrySerial.set(device, serialnumber);
                };
                handleOpen(device).catch(console.error);
                void this.scan().catch(console.error);
            }
        });
        usb.on('detach', (device) => {
            if (
                device.deviceDescriptor.idVendor === SPIKE_USB_VENDOR_ID_NUM &&
                device.deviceDescriptor.idProduct === SPIKE_USB_PRODUCT_ID_NUM
            ) {
                const serialnumber = this.usbRegistrySerial.get(device);
                if (serialnumber) {
                    for (const [id, metadata] of this._allDevices.entries()) {
                        if (
                            metadata instanceof DeviceMetadataForUSB &&
                            metadata.serialNumber === serialnumber
                        ) {
                            metadata.validTill = 0;
                            this._allDevices.delete(id);
                            this._listeners.forEach((fn) => fn(metadata));
                        }
                    }
                }
                this.usbRegistrySerial.delete(device);
            }
        });
        await this.scan();
    }

    private _scanning = false;
    private async scan() {
        if (this._scanning) return;
        this._scanning = true;
        try {
            const ports = await SerialPort.list();
            const portsOk = ports.filter(
                (port) =>
                    port.vendorId === SPIKE_USB_VENDOR_ID &&
                    port.productId === SPIKE_USB_PRODUCT_ID,
            );
            for (const port of portsOk) {
                const serialNumber = port.serialNumber ?? 'unknown';
                const newMetadata = new DeviceMetadataForUSB(
                    HubOSUsbClient.devtype,
                    port,
                    serialNumber,
                );

                try {
                    this._allDevices.set(newMetadata.id, newMetadata);

                    if (newMetadata.devtype === HubOSUsbClient.devtype) {
                        setTimeout(
                            () =>
                                void HubOSUsbClient.refreshDeviceName(newMetadata)
                                    .then(() =>
                                        this._listeners.forEach((fn) =>
                                            fn(newMetadata),
                                        ),
                                    )
                                    .catch(console.error),
                            0,
                        );
                        this._listeners.forEach((fn) => fn(newMetadata));
                    }
                } catch (_e) {
                    newMetadata.validTill = 0;
                    this._allDevices.delete(newMetadata.id);
                }
            }
        } finally {
            this._scanning = false;
        }
    }

    public async connect(id: string, devtype: string): Promise<void> {
        const metadata = this._allDevices.get(id);
        if (!metadata) throw new Error(`Device ${id} not found.`);

        switch (metadata.devtype) {
            case HubOSUsbClient.devtype:
                this._client = new HubOSUsbClient(metadata);
                break;
            default:
                throw new Error(`Unknown device type: ${metadata.devtype}`);
        }

        await super.connect(id, devtype);
    }

    public async disconnect() {
        await super.disconnect();
    }

    public get allDevices() {
        return this._allDevices;
    }

    public waitForReadyAsync(_timeout: number = 10000): Promise<void> {
        return Promise.resolve();
    }
}

async function _getUsbStringDescriptor(device: usb.Device, desc_index: number) {
    const promise = new Promise<string | undefined>((resolve, reject) => {
        device.getStringDescriptor(desc_index, (error, data) => {
            if (error) reject(error);
            else resolve(data);
        });
    });
    return promise;
}
