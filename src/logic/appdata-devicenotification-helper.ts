import { DeviceNotificationPayload } from '../spike/utils/device-notification';

export async function handleDeviceNotificationAsync(
    _payloads: DeviceNotificationPayload[] | undefined,
) {
    // const data = payloads?.find((p) => p.type === 'imu');
    // // const data = payloads?.find((p) => p.type === 'force');
    // if (data) {
    //     if (!plotManager?.running) plotManager?.start(['data']);
    //     plotManager?.setBufferAt(0, data.yaw);
    //     plotManager?.flushPlotBuffer();
    // }
}
