export class UUIDu {
    static to128(uuid: string | number): string {
        if (typeof uuid === 'number') {
            return (
                ('00000000' + uuid.toString(16)).slice(-8) +
                '-0000-1000-8000-00805f9b34fb'
            );
        }
        return uuid;
    }

    static to16(uuid: string | number): string {
        if (typeof uuid === 'number') {
            return uuid.toString(16).slice(-4);
        }
        return uuid;
    }

    static toString(uuid: string | number, expand: boolean = false): string {
        if (typeof uuid === 'number') {
            uuid = uuid.toString(16).slice(-4);
        }

        const cleaned = uuid.replace(/[^a-fA-F0-9]/g, '').toLowerCase();
        if (cleaned.length === 4) {
            if (!expand) return cleaned;
            else return '0000' + cleaned + '-0000-1000-8000-00805f9b34fb';
        } else if (cleaned.length === 8) {
            return cleaned + '-0000-1000-8000-00805f9b34fb';
        } else if (cleaned.length === 32) {
            return (
                cleaned.slice(0, 8) +
                '-' +
                cleaned.slice(8, 12) +
                '-' +
                cleaned.slice(12, 16) +
                '-' +
                cleaned.slice(16, 20) +
                '-' +
                cleaned.slice(20)
            );
        }
        return cleaned;
    }

    static equalUuids(a: string | number, b: string | number): boolean {
        return (
            UUIDu.toString(a).replace(/-/g, '').toLowerCase() ===
            UUIDu.toString(b).replace(/-/g, '').toLowerCase()
        );
    }
}
