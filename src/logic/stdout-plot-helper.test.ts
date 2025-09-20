import { BUFFER_FLUSH_TIMEOUT, PlotManager } from './plot';
import { parsePlotCommand } from './stdout-plot-helper';

const onPlotStartedMock = jest.fn();
const onPlotDataMock = jest.fn();

let fakeTimestamp = 0;
jest.spyOn(Date, 'now').mockImplementation(() => {
    fakeTimestamp += 1000;
    return fakeTimestamp;
});

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

let disposables: { dispose: () => void }[] = [];
let plotManager: PlotManager | undefined;
beforeEach(() => {
    jest.useFakeTimers();
    plotManager = new PlotManager();
    disposables.push(plotManager.onPlotStarted.event(onPlotStartedMock));
    disposables.push(plotManager.onPlotData.event(onPlotDataMock));
});

function parsePlotCommandWithManager(line: string) {
    return parsePlotCommand(line, plotManager);
}

describe('plot-helper', () => {
    it('should write headers when plot is started', async () => {
        await parsePlotCommandWithManager('plot: start sensor1,sensor2,gyro');
        expect(onPlotStartedMock).toHaveBeenCalledWith([
            'timestamp',
            'sensor1',
            'sensor2',
            'gyro',
        ]);
    });

    it('should write data line with comma separated values', async () => {
        await parsePlotCommandWithManager('plot: start sensor1,sensor2,gyro');
        await parsePlotCommandWithManager('plot:  10,20,30');
        expect(onPlotStartedMock).toHaveBeenCalledTimes(1);
        expect(onPlotDataMock).toHaveBeenCalledWith([0, 10, 20, 30]);
    });

    it('should write data line with multiple values - respecting spaces, signs and decimals', async () => {
        await parsePlotCommandWithManager('plot: start sensor1,sensor2,gyro');
        await parsePlotCommandWithManager('plot:   10.0 ,   +20, -30.2  ');
        expect(onPlotStartedMock).toHaveBeenCalledTimes(1);
        expect(onPlotDataMock).toHaveBeenCalledWith([0, 10, 20, -30.2]);
    });

    it('should write data with sensor:value pairs', async () => {
        await parsePlotCommandWithManager('plot: start sensor1,sensor2,gyro');
        await parsePlotCommandWithManager('plot: sensor1:10, sensor2:20, gyro:30');
        expect(onPlotStartedMock).toHaveBeenCalledTimes(1);
        expect(onPlotDataMock).toHaveBeenCalledWith([0, 10, 20, 30]);
    });

    it('should write data with sensor:value pairs - respecting spaces, signs and decimals', async () => {
        await parsePlotCommandWithManager('plot: start sensor1,sensor2,gyro');
        await parsePlotCommandWithManager(
            'plot:   sensor1: 10  sensor2:-10.5 , gyro: +22  ',
        );
        expect(onPlotStartedMock).toHaveBeenCalledTimes(1);
        expect(onPlotDataMock).toHaveBeenCalledWith([0, 10, -10.5, 22]);
    });

    it('should not write data line with gaps in multiple values', async () => {
        await parsePlotCommandWithManager('plot: start sensor1,sensor2,gyro');
        await parsePlotCommandWithManager('plot: 10,20,');
        expect(onPlotStartedMock).toHaveBeenCalledTimes(1);
        expect(onPlotDataMock).not.toHaveBeenCalled(); // Only header line
    });

    it('should not write data line with gaps in paired values', async () => {
        await parsePlotCommandWithManager('plot: start sensor1,sensor2,gyro');
        await parsePlotCommandWithManager('plot: sensor1:10, sensor2:20');
        expect(onPlotStartedMock).toHaveBeenCalledTimes(1);
        expect(onPlotDataMock).not.toHaveBeenCalled(); // Only header line
    });

    it('should write data filling in gaps in multiple values', async () => {
        await parsePlotCommandWithManager('plot: start sensor1,sensor2,gyro');
        await parsePlotCommandWithManager('plot: 10,20,');
        await parsePlotCommandWithManager('plot: ,,30');
        expect(onPlotStartedMock).toHaveBeenCalledTimes(1);
        expect(onPlotDataMock).toHaveBeenCalledWith([0, 10, 20, 30]);
    });

    it('should write data filling in gaps in paired values', async () => {
        await parsePlotCommandWithManager('plot: start sensor1,sensor2,gyro');
        await parsePlotCommandWithManager('plot: sensor1:10,sensor2:20');
        await parsePlotCommandWithManager('plot: gyro:30');
        expect(onPlotStartedMock).toHaveBeenCalledTimes(1);
        expect(onPlotDataMock).toHaveBeenCalledWith([0, 10, 20, 30]);
    });

    it('should write data respecting clashes for gaps in multiple values', async () => {
        await parsePlotCommandWithManager('plot: start sensor1,sensor2,gyro');
        await parsePlotCommandWithManager('plot: 10');
        await parsePlotCommandWithManager('plot: ,20');
        await parsePlotCommandWithManager('plot: ,40,50');
        await parsePlotCommandWithManager('plot: end');
        expect(onPlotStartedMock).toHaveBeenCalledTimes(1);
        expect(onPlotDataMock).toHaveBeenCalledTimes(2);
        expect(onPlotDataMock).toHaveBeenCalledWith([0, 10, 20, NaN]);
        expect(onPlotDataMock).toHaveBeenCalledWith([0, NaN, 40, 50]);
    });

    it('should write data respecting clashes for gaps in multiple values', async () => {
        await parsePlotCommandWithManager('plot: start sensor1,sensor2,gyro');
        await parsePlotCommandWithManager('plot: 10');
        await parsePlotCommandWithManager('plot: sensor2:20');
        await parsePlotCommandWithManager('plot: sensor1:30');
        await parsePlotCommandWithManager('plot: end');
        expect(onPlotStartedMock).toHaveBeenCalledTimes(1);
        expect(onPlotDataMock).toHaveBeenCalledTimes(2);
        expect(onPlotDataMock).toHaveBeenCalledWith([0, 10, 20, NaN]);
        expect(onPlotDataMock).toHaveBeenCalledWith([0, 30, NaN, NaN]);
    });

    it('should not write partial data on early close', async () => {
        await parsePlotCommandWithManager('plot: start sensor1,sensor2,gyro');
        await parsePlotCommandWithManager('plot: 10');
        expect(onPlotStartedMock).toHaveBeenCalledTimes(1);
        expect(onPlotDataMock).not.toHaveBeenCalled(); // Only header line
    });

    it('should not write partial data on normal close', async () => {
        await parsePlotCommandWithManager('plot: start sensor1,sensor2,gyro');
        await parsePlotCommandWithManager('plot: 10');
        await parsePlotCommandWithManager('plot: end');
        expect(onPlotStartedMock).toHaveBeenCalledTimes(1);
        expect(onPlotDataMock).toHaveBeenCalledTimes(1);
    });

    it('should write partial data on timeout > flush timeout', async () => {
        await parsePlotCommandWithManager('plot: start sensor1,sensor2,gyro');
        await parsePlotCommandWithManager('plot: 10');
        jest.advanceTimersByTime(BUFFER_FLUSH_TIMEOUT + 100);

        expect(onPlotStartedMock).toHaveBeenCalledTimes(1);
        expect(onPlotDataMock).toHaveBeenCalledTimes(1);
    });

    it('should not write partial data on timeout < flush timeout', async () => {
        await parsePlotCommandWithManager('plot: start sensor1,sensor2,gyro');
        await parsePlotCommandWithManager('plot: 10');
        jest.advanceTimersByTime(BUFFER_FLUSH_TIMEOUT - 100);

        expect(onPlotStartedMock).toHaveBeenCalledTimes(1);
        expect(onPlotDataMock).not.toHaveBeenCalled();
    });

    it('should ignore invalid data in multiple values', async () => {
        await parsePlotCommandWithManager('plot: start sensor1,sensor2,gyro');
        await parsePlotCommandWithManager('plot: banán,10,20');
        expect(onPlotStartedMock).toHaveBeenCalledTimes(1);
        expect(onPlotDataMock).not.toHaveBeenCalled();
    });

    it('should ignore invalid date in pair values', async () => {
        await parsePlotCommandWithManager('plot: start sensor1,sensor2,gyro');
        await parsePlotCommandWithManager('plot: sensor1:banán');
        expect(onPlotStartedMock).toHaveBeenCalledTimes(1);
        expect(onPlotDataMock).not.toHaveBeenCalled();
    });
});

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

afterEach(async () => {
    jest.useRealTimers();
    onPlotStartedMock.mockClear();
    onPlotDataMock.mockClear();
    disposables.forEach((d) => d.dispose());
});
