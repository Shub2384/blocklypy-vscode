let writtenData: string[] = [];
let writtenLastLine: string | undefined = undefined;
const writeMock = jest.fn((chunk) => {
    writtenData.push(chunk.replace(/[\r\n]$/, ''));
    writtenLastLine = writtenData[writtenData.length - 1];
});
const endMock = jest.fn((cb?: () => void) => cb && cb());
const onMock = jest.fn();
let fakeTimestamp = 0;
jest.spyOn(Date, 'now').mockImplementation(() => {
    fakeTimestamp += 1000;
    return fakeTimestamp;
});

jest.mock('fs', () => ({
    ...jest.requireActual('fs'),
    createWriteStream: jest.fn((filePath: string, options?: any) => ({
        write: writeMock,
        end: endMock,
        on: onMock,
        path: filePath,
    })),
}));

jest.mock('../utils/files', () => ({
    getActiveFileFolder: () => '/tmp/test-folder',
}));

expect.extend({
    toEndsWith(received, suffix) {
        const pass = typeof received === 'string' && received.endsWith(suffix);
        return {
            pass,
            message: () =>
                `expected '${received}' ${pass ? 'not ' : ''}to end with '${suffix}'`,
        };
    },
});

declare global {
    namespace jest {
        interface Matchers<R> {
            toEndsWith(suffix: string): R;
        }
    }
}

import { BUFFER_FLUSH_TIMEOUT, parsePlotCommand } from './stdout-plot-helper';

describe('plot-helper', () => {
    it('should write headers when plot is started', async () => {
        await parsePlotCommand('plot: start sensor1,sensor2,gyro');
        expect(writtenLastLine).toEqual('timestamp,sensor1,sensor2,gyro');
    });

    it('should write data line with comma separated values', async () => {
        await parsePlotCommand('plot: start sensor1,sensor2,gyro');
        await parsePlotCommand('plot:  10,20,30');
        expect(writtenLastLine).toEndsWith('10,20,30');
    });

    it('should write data line with multipla values - respecting spaces, signs and decimals', async () => {
        await parsePlotCommand('plot: start sensor1,sensor2,gyro');
        await parsePlotCommand('plot:   10.0 ,   +20, -30.2  ');
        expect(writtenLastLine).toEndsWith('10,20,-30.2');
    });

    it('should write data with sensor:value pairs', async () => {
        await parsePlotCommand('plot: start sensor1,sensor2,gyro');
        await parsePlotCommand('plot: sensor1:10, sensor2:20, gyro:30');
        expect(writtenLastLine).toEndsWith('10,20,30');
    });

    it('should write data with sensor:value pairs - respecting spaces, signs and decimals', async () => {
        await parsePlotCommand('plot: start sensor1,sensor2,gyro');
        await parsePlotCommand('plot:   sensor1: 10  sensor2:-10.5 , gyro: +22  ');
        expect(writtenLastLine).toEndsWith('10,-10.5,22');
    });

    it('should not write data line with gaps in multiple values', async () => {
        await parsePlotCommand('plot: start sensor1,sensor2,gyro');
        await parsePlotCommand('plot: 10,20,');
        expect(writtenData).toHaveLength(1); // Only header line
    });

    it('should not write data line with gaps in paired values', async () => {
        await parsePlotCommand('plot: start sensor1,sensor2,gyro');
        await parsePlotCommand('plot: sensor1:10, sensor2:20');
        expect(writtenData).toHaveLength(1); // Only header line
    });

    it('should write data filling in gaps in multiple values', async () => {
        await parsePlotCommand('plot: start sensor1,sensor2,gyro');
        await parsePlotCommand('plot: 10,20,');
        await parsePlotCommand('plot: ,,30');
        expect(writtenLastLine).toEndsWith('10,20,30');
    });

    it('should write data filling in gaps in paired values', async () => {
        await parsePlotCommand('plot: start sensor1,sensor2,gyro');
        await parsePlotCommand('plot: sensor1:10,sensor2:20');
        await parsePlotCommand('plot: gyro:30');
        expect(writtenLastLine).toEndsWith('10,20,30');
    });

    it('should write data respecting clashes for gaps in multiple values', async () => {
        await parsePlotCommand('plot: start sensor1,sensor2,gyro');
        await parsePlotCommand('plot: 10');
        await parsePlotCommand('plot: ,20');
        await parsePlotCommand('plot: ,40,50');
        await parsePlotCommand('plot: end');
        expect(writtenData).toHaveLength(3);
        expect(writtenData[1]).toEndsWith('10,20,');
        expect(writtenData[2]).toEndsWith(',40,50');
    });

    it('should write data respecting clashes for gaps in multiple values', async () => {
        await parsePlotCommand('plot: start sensor1,sensor2,gyro');
        await parsePlotCommand('plot: 10');
        await parsePlotCommand('plot: sensor2:20');
        await parsePlotCommand('plot: sensor1:30');
        await parsePlotCommand('plot: end');
        expect(writtenData).toHaveLength(3);
        expect(writtenData[1]).toEndsWith('10,20,');
        expect(writtenData[2]).toEndsWith('30,,');
    });

    it('should not write partial data on early close', async () => {
        await parsePlotCommand('plot: start sensor1,sensor2,gyro');
        await parsePlotCommand('plot: 10');
        expect(writtenData).toHaveLength(1);
    });

    it('should not write partial data on normal close', async () => {
        await parsePlotCommand('plot: start sensor1,sensor2,gyro');
        await parsePlotCommand('plot: 10');
        await parsePlotCommand('plot: end');
        expect(writtenData).toHaveLength(2);
    });

    it('should write partial data on timeout > flush timeout', async () => {
        await parsePlotCommand('plot: start sensor1,sensor2,gyro');
        await parsePlotCommand('plot: 10');
        jest.advanceTimersByTime(BUFFER_FLUSH_TIMEOUT + 100);

        expect(writtenData).toHaveLength(2);
    });

    it('should not write partial data on timeout < flush timeout', async () => {
        await parsePlotCommand('plot: start sensor1,sensor2,gyro');
        await parsePlotCommand('plot: 10');
        jest.advanceTimersByTime(BUFFER_FLUSH_TIMEOUT - 100);
        expect(writtenData).toHaveLength(1);
    });

    it('should ignore invalid data in multiple values', async () => {
        await parsePlotCommand('plot: start sensor1,sensor2,gyro');
        await parsePlotCommand('plot: banán,10,20');
        expect(writtenData).toHaveLength(1);
    });
    it('should ignore invalid date in pair values', async () => {
        await parsePlotCommand('plot: start sensor1,sensor2,gyro');
        await parsePlotCommand('plot: sensor1:banán');
        expect(writtenData).toHaveLength(1);
    });

    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(async () => {
        writtenData = [];
        writtenLastLine = undefined;
        writeMock.mockClear();
        endMock.mockClear();
        onMock.mockClear();
        jest.useRealTimers();
    });
});

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
