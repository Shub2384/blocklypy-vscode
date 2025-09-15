import { default as uPlot } from 'uplot';
import 'uplot/dist/uPlot.min.css';

const MAX_DATA_POINTS = 200; // max points to keep in chart
// const COLORS = [
//     'blue',
//     'green',
//     'red',
//     'orange',
//     'purple',
//     'cyan',
//     'magenta',
//     'yellow',
// ];

const COLORS = [
    '#7EB26D', // 0: pale green
    '#EAB839', // 1: mustard
    '#6ED0E0', // 2: light blue
    '#EF843C', // 3: orange
    '#E24D42', // 4: red
    '#1F78C1', // 5: ocean
    '#BA43A9', // 6: purple
    '#705DA0', // 7: violet
    '#508642', // 8: dark green
    '#CCA300', // 9: dark sand
];

let chart: uPlot | undefined;
let chartData: number[][] = [];
let chartSeries: string[] = [];

declare const acquireVsCodeApi: any;
const vscode = acquireVsCodeApi();

window.addEventListener('message', (event) => {
    const { command, payload } = event.data || {};
    if (command === 'setHeaders') {
        const { cols, rows } = payload;
        setHeaders(cols, rows);
    } else if (command === 'addData') {
        addData(payload);
    }
});

window.addEventListener('resize', (e) => {
    chart?.setSize(getSize());
});

// function getVsCodeTheme() {
//     return document.body.classList.contains('vscode-dark') ? 'vs-dark' : 'vs-light';
// }
// window.addEventListener('vscode-theme-change', () => {
//     if (chart && chartSeries.length > 0) {
//         setHeaders(chartSeries, chartData);
//     }
// });

function getSize() {
    return {
        width: window.innerWidth,
        height: window.innerHeight,
    };
}

function setHeaders(names: string[], data: number[][] = []) {
    chartSeries = names; // first is x-axis
    chartData =
        data.length === names.length
            ? data
            : Array.from({ length: names.length }, () => []);

    const dataSeriesNames = names.slice(1);
    // const isLight = getVsCodeTheme() === 'vs-light';

    // TODO: somehow make there is a narrow gap on the top - to be removed
    const opts: uPlot.Options = {
        legend: { show: false },
        ...getSize(),
        series: [
            // x-axis
            {
                scale: 'x',
                label: names[0],
                width: 2,
                stroke: '#7774',
            },
            // y-axes
            ...dataSeriesNames.map((name, idx) => ({
                scale: `num${idx}`,
                label: name,
                width: 2,
                stroke: COLORS[idx % COLORS.length],
                fill: COLORS[idx % COLORS.length] + '22',
            })),
        ],
        axes: [
            {
                scale: 'x',
                stroke: '#7779',
                grid: {
                    show: true,
                    stroke: '#7776',
                    dash: [],
                    width: 2,
                },
                ticks: { show: true, stroke: '#7776' },
                gap: 0,
                size: 25,
                labelSize: 12,
            },
            ...dataSeriesNames.map((name, idx) => ({
                label: name,
                scale: `num${idx}`,
                stroke: COLORS[idx % COLORS.length],
                gap: 0,
                size: 30,
                grid: {
                    show: true,
                    stroke: '#7776',
                    dash: [2, 5],
                    width: 1,
                },
                ticks: { show: true, stroke: '#7776' },
                labelSize: 12,
            })),
        ],
        scales: {
            x: {
                time: false,
            },
        },
    };

    const container = document.getElementById('chart-container');
    if (container) {
        container.innerHTML = ''; // Clear any existing chart
        const alignedData = chartData.map((arr) => new Float64Array(arr));
        chart = new uPlot(opts, alignedData, container);
    }
}

function addData(line: number[]) {
    if (chart && chartSeries.length > 0) {
        chartSeries.forEach((_, index) => {
            chartData[index].push(line[index]);
        });

        // sliding window to keep max data points
        if (chartData[0].length > MAX_DATA_POINTS) {
            chartData.forEach((arr) => arr.splice(0, arr.length - MAX_DATA_POINTS));
        }

        const alignedData = chartData.map((arr) => new Float64Array(arr));
        chart.setData(alignedData);
    }
}
