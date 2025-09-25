import { PortInfo } from '@serialport/bindings-interface';
import { SerialPort } from 'serialport';
import { usb } from 'usb';
import { ConnectionState, DeviceMetadata } from '..';
import {
    SPIKE_USB_PRODUCT_ID,
    SPIKE_USB_PRODUCT_ID_NUM,
    SPIKE_USB_VENDOR_ID,
    SPIKE_USB_VENDOR_ID_NUM,
} from '../../spike/protocol';
import { HubOSUsbClient } from '../clients/hubos-usb-client';
import { BaseLayer, ConnectionStateChangeEvent, DeviceChangeEvent } from './base-layer';

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

    public get hasResolvedName(): boolean {
        return this._resolvedName !== undefined;
    }

    public get id(): string {
        return DeviceMetadata.generateId(this.devtype, this.portinfo.path);
    }
}

export class USBLayer extends BaseLayer {
    private _supportsHotPlug: boolean = false;
    private _scanHandle: NodeJS.Timeout | undefined = undefined;
    private _isWithinScan: boolean = false;

    public supportsDevtype(_devtype: string) {
        return HubOSUsbClient.devtype === _devtype;
    }

    constructor(
        onStateChange?: (event: ConnectionStateChangeEvent) => void,
        onDeviceChange?: (device: DeviceChangeEvent) => void,
    ) {
        super(onStateChange, onDeviceChange);

        this.state = ConnectionState.Disconnected; // initialized successfully
    }

    private usbRegistrySerial = new Map<usb.Device, string>();

    private handleUsbAttach(device: usb.Device) {
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
    }

    private handleUsbDetach(device: usb.Device) {
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
                        this._deviceChange.fire({ metadata });
                    }
                }
            }
            this.usbRegistrySerial.delete(device);
        }
    }

    public async startup() {
        await super.startup();

        try {
            usb.on('attach', this.handleUsbAttach.bind(this));
            usb.on('detach', this.handleUsbDetach.bind(this));
            this._supportsHotPlug = true;
        } catch (e) {
            console.error('Error setting up USB listeners:', e);
            this._supportsHotPlug = false;

            // Fallback: Periodic scanning
            await this.startScanning();
        }

        await this.scan();
    }

    public stopScanning() {
        if (this._scanHandle) {
            clearInterval(this._scanHandle);
            this._scanHandle = undefined;
        }
    }

    public async startScanning() {
        if (this.scanning) return;

        this._scanHandle = setInterval(() => {
            void this.scan().catch(console.error);
        }, 10000);

        return Promise.resolve();
    }

    private async scan() {
        if (this._isWithinScan) return;
        this._isWithinScan = true;
        try {
            const ports = await SerialPort.list();
            const portsOk = ports.filter(
                (port) =>
                    port.vendorId === SPIKE_USB_VENDOR_ID &&
                    port.productId === SPIKE_USB_PRODUCT_ID,
            );
            for (const port of portsOk) {
                const serialNumber = port.serialNumber ?? 'unknown';

                const targetid = DeviceMetadata.generateId(
                    HubOSUsbClient.devtype,
                    port.path,
                );
                let metadata = this._allDevices.get(targetid) as DeviceMetadataForUSB;

                if (!metadata) {
                    metadata = new DeviceMetadataForUSB(
                        HubOSUsbClient.devtype,
                        port,
                        serialNumber,
                    );
                }
                this._allDevices.set(metadata.id, metadata);

                // If the device is not hot-pluggable, we set a timeout to forget it again
                if (!this._supportsHotPlug) metadata.validTill = Date.now() + 15000;

                try {
                    if (
                        metadata.devtype === HubOSUsbClient.devtype &&
                        !metadata.hasResolvedName
                    ) {
                        // try to get the real name from the device
                        await HubOSUsbClient.refreshDeviceName(metadata);
                    }
                    this._deviceChange.fire({ metadata });
                } catch (_e) {
                    metadata.validTill = 0;
                    this._allDevices.delete(metadata.id);
                }
            }
        } catch (e) {
            console.error('Error scanning USB devices:', e);
        } finally {
            this._isWithinScan = false;
        }
    }

    public async connect(id: string, devtype: string): Promise<void> {
        const metadata = this._allDevices.get(id);
        if (!metadata) {
            console.log(this._allDevices);
            throw new Error(`Device ${id} not found.`);
        }

        switch (metadata.devtype) {
            case HubOSUsbClient.devtype:
                this._client = new HubOSUsbClient(metadata, this);
                break;
            // case PybricksUsbClient.devtype:
            //     this._client = new PybricksUsbClient(metadata);
            //     break;
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

    public get scanning() {
        return !!this._scanHandle;
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
