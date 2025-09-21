import { PlotManager } from './plot';

export const PLOT_COMMAND_PREFIX = 'plot:';

export async function parsePlotCommand(
    line: string,
    plotManager: PlotManager | undefined,
) {
    if (!plotManager) return;

    if (!line.startsWith(PLOT_COMMAND_PREFIX)) return;
    const line1 = line.substring(PLOT_COMMAND_PREFIX.length).trim();

    // start command with column definitions
    const defMatch = /^start (.+)$/.exec(line1);
    if (defMatch) {
        const columns = defMatch[1].split(',').map((v) => v.trim());
        plotManager.start(columns);
        return;
    }

    // end command
    if (/^end$/.test(line1)) {
        await plotManager.stop();
        return;
    }

    if (!plotManager.running) return;
    let values: number[] = [];
    // sensor:value pairs, allowing missing values (e.g. "a:1, b:, c:3")
    if (/^([\w]+:\s*([-+]?\d*\.?\d+)?\s*[, ]*)+$/.test(line1)) {
        const matches = Array.from(line1.matchAll(/([\w]+):\s*([-+]?\d*\.?\d+)?/g));
        values = plotManager.getColumns().map((col) => {
            const m = matches.find((match) => match[1] === col);
            return m && m[2] !== undefined ? parseFloat(m[2]) : NaN;
        });
    }

    // comma separated values, allowing missing values (e.g. "1, ,3" or "1,,3" or "1,2" or ",2,3")
    else if (/^(([-+]?\d*\.?\d+)?\s*,?\s*)+$/.test(line1)) {
        // Split by comma, trim whitespace, and parse numbers or NaN for missing
        values = line1.split(',').map((v) => {
            const num = v.trim();
            return num ? Number(num) : NaN;
        });
    }

    // handle the parsed values
    plotManager.handleIncomingData(values);
}
