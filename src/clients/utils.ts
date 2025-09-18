export function uuid128(uuid: string | number): string {
    if (typeof uuid === 'number') {
        return (
            ('00000000' + uuid.toString(16)).slice(-8) + '-0000-1000-8000-00805f9b34fb'
        );
    }
    return uuid;
}

export function uuid16(uuid: number): string {
    return ('0000' + uuid.toString(16)).slice(-4).toLowerCase();
}

export function uuidStr(uuid: string | number): string {
    if (typeof uuid === 'number') return uuid16(uuid);
    else return uuid;
}

export function equalUuids(a: string | number, b: string | number): boolean {
    return (
        uuidStr(a).replace(/-/g, '').toLowerCase() ===
        uuidStr(b).replace(/-/g, '').toLowerCase()
    );
}
