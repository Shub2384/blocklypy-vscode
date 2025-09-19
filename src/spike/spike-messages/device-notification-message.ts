import { ResponseMessage } from './base-message';

export type DeviceNotificationPayload =
    | { type: 'battery'; batteryLevel: number }
    | {
          type: 'imu';
          faceUp: number;
          yawFace: number;
          yaw: number;
          pitch: number;
          roll: number;
          accX: number;
          accY: number;
          accZ: number;
          gyroX: number;
          gyroY: number;
          gyroZ: number;
      }
    | { type: 'matrix5x5'; pixels: number[] }
    | {
          type: 'motor';
          port: number;
          deviceType: number;
          absPos: number;
          power: number;
          speed: number;
          position: number;
      }
    | { type: 'force'; port: number; value: number; pressed: boolean }
    | {
          type: 'color';
          port: number;
          color: number;
          red: number;
          green: number;
          blue: number;
      }
    | { type: 'distance'; port: number; distance: number }
    | { type: 'matrix3x3'; port: number; pixels: number[] }
    | { type: 'unknown'; msgType: number; raw: Uint8Array };

export class DeviceNotificationMessage extends ResponseMessage {
    public static readonly Id = 0x3c;

    constructor(public payloads: DeviceNotificationPayload[]) {
        super();
    }

    public static fromBytes(data: Uint8Array): DeviceNotificationMessage {
        if (data[0] !== DeviceNotificationMessage.Id) {
            throw new Error('Invalid DeviceNotificationMessage');
        }
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        const payloadSize = view.getUint16(1, true);
        let offset = 3;
        const payloads: DeviceNotificationPayload[] = [];
        while (offset < 3 + payloadSize && offset < data.length) {
            const msgType = data[offset];
            switch (msgType) {
                case 0x00: {
                    // DeviceBattery
                    const batteryLevel = data[offset + 1];
                    payloads.push({ type: 'battery', batteryLevel });
                    offset += 2;
                    break;
                }
                case 0x01: {
                    // DeviceImuValues
                    const faceUp = data[offset + 1];
                    const yawFace = data[offset + 2];
                    const yaw = view.getInt16(offset + 3, true);
                    const pitch = view.getInt16(offset + 5, true);
                    const roll = view.getInt16(offset + 7, true);
                    const accX = view.getInt16(offset + 9, true);
                    const accY = view.getInt16(offset + 11, true);
                    const accZ = view.getInt16(offset + 13, true);
                    const gyroX = view.getInt16(offset + 15, true);
                    const gyroY = view.getInt16(offset + 17, true);
                    const gyroZ = view.getInt16(offset + 19, true);
                    payloads.push({
                        type: 'imu',
                        faceUp,
                        yawFace,
                        yaw,
                        pitch,
                        roll,
                        accX,
                        accY,
                        accZ,
                        gyroX,
                        gyroY,
                        gyroZ,
                    });
                    offset += 21;
                    break;
                }
                case 0x02: {
                    // Device5x5MatrixDisplay
                    const pixels = Array.from(data.slice(offset + 1, offset + 26));
                    payloads.push({ type: 'matrix5x5', pixels });
                    offset += 26;
                    break;
                }
                case 0x0a: {
                    // DeviceMotor
                    const port = data[offset + 1];
                    const deviceType = data[offset + 2];
                    const absPos = view.getInt16(offset + 3, true);
                    const power = view.getInt16(offset + 5, true);
                    const speed = view.getInt8(offset + 7);
                    const position = view.getInt32(offset + 8, true);
                    payloads.push({
                        type: 'motor',
                        port,
                        deviceType,
                        absPos,
                        power,
                        speed,
                        position,
                    });
                    offset += 12;
                    break;
                }
                case 0x0b: {
                    // DeviceForceSensor
                    const port = data[offset + 1];
                    const value = data[offset + 2];
                    const pressed = data[offset + 3] === 1;
                    payloads.push({ type: 'force', port, value, pressed });
                    offset += 4;
                    break;
                }
                case 0x0c: {
                    // DeviceColorSensor
                    const port = data[offset + 1];
                    const color = view.getInt8(offset + 2);
                    const red = view.getUint16(offset + 3, true);
                    const green = view.getUint16(offset + 5, true);
                    const blue = view.getUint16(offset + 7, true);
                    payloads.push({ type: 'color', port, color, red, green, blue });
                    offset += 9;
                    break;
                }
                case 0x0d: {
                    // DeviceDistanceSensor
                    const port = data[offset + 1];
                    const distance = view.getInt16(offset + 2, true);
                    payloads.push({ type: 'distance', port, distance });
                    offset += 4;
                    break;
                }
                case 0x0e: {
                    // Device3x3ColorMatrix
                    const port = data[offset + 1];
                    const pixels = Array.from(data.slice(offset + 2, offset + 11));
                    payloads.push({ type: 'matrix3x3', port, pixels });
                    offset += 11;
                    break;
                }
                default: {
                    // Unknown message type
                    const end = Math.min(offset + 1, data.length);
                    payloads.push({
                        type: 'unknown',
                        msgType,
                        raw: data.slice(offset, end),
                    });
                    offset += 1;
                    break;
                }
            }
        }
        return new DeviceNotificationMessage(payloads);
    }
}
