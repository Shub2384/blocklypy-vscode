import { LegoCompanyId } from './ble-lwp3-service/protocol';

enum PbBleBroadcastDataType {
    SingleObject = 0,
    True = 1,
    False = 2,
    Int = 3,
    Float = 4,
    Str = 5,
    Bytes = 6,
}

export type PybricksDecodedBleBroadcast = {
    channel: number;
    data: (boolean | number | string | Buffer)[];
};

function pybricksDecodeOne(
    buffer: Buffer,
    startIndex: number,
): { value: any; nextIndex: number } | undefined {
    if (startIndex >= buffer.length) return undefined;
    const typeAndSize = buffer[startIndex];
    const type = typeAndSize >> 5;
    const size = typeAndSize & 0x1f;
    let index = startIndex + 1;

    switch (type) {
        case PbBleBroadcastDataType.True:
            return { value: true, nextIndex: index };
        case PbBleBroadcastDataType.False:
            return { value: false, nextIndex: index };
        case PbBleBroadcastDataType.Int:
            if (size === 1) {
                const v = buffer.readInt8(index);
                return { value: v, nextIndex: index + 1 };
            } else if (size === 2) {
                const v = buffer.readInt16LE(index);
                return { value: v, nextIndex: index + 2 };
            } else if (size === 4) {
                const v = buffer.readInt32LE(index);
                return { value: v, nextIndex: index + 4 };
            }
            break;
        case PbBleBroadcastDataType.Float:
            if (size === 4) {
                const v = buffer.readFloatLE(index);
                return { value: v, nextIndex: index + 4 };
            }
            break;
        case PbBleBroadcastDataType.Str: {
            const v = buffer.toString('utf8', index, index + size);
            return { value: v, nextIndex: index + size };
        }
        case PbBleBroadcastDataType.Bytes: {
            const v = buffer.slice(index, index + size);
            return { value: v, nextIndex: index + size };
        }
        case PbBleBroadcastDataType.SingleObject:
            // Only used as indicator, not a value
            return undefined;
    }
    // Unknown or invalid type/size
    return undefined;
}

export function pybricksDecodeBleBroadcastData(
    buffer: Buffer,
): PybricksDecodedBleBroadcast | undefined {
    // Manufacturer data format: [LEGO_CID(0x0397)][channel][payload...]
    if (!buffer || buffer?.length < 3 || buffer.readUInt16LE(0) !== LegoCompanyId)
        return;

    const channel = buffer.readUInt8(2);

    let index = 3;
    const data = [] as any[];
    if (buffer[index] >> 5 === PbBleBroadcastDataType.SingleObject) {
        // Skip the SingleObject indicator byte
        index += 1;
    }

    while (index < buffer.length) {
        const value = pybricksDecodeOne(buffer, index);
        if (value === undefined) break;
        data.push(value.value);
        index = value.nextIndex;
    }
    return { channel, data };
}
