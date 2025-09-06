/**
 * This is the script for the BlocklyPy webview.
 * It is compiled separately from the main extension code.
 * See tsconfig.webview.json and .vscode/tasks.json.
 */

import svgPanZoom from 'svg-pan-zoom';
import * as monaco from 'monaco-editor';

declare const acquireVsCodeApi: any;
const vscode = acquireVsCodeApi();

let monacoInstance: monaco.editor.IStandaloneCodeEditor | undefined = undefined;

const ViewType = {
    Preview: 'preview',
    Pseudo: 'pseudo',
    Pycode: 'pycode',
    Graph: 'graph',
};

function getVsCodeTheme() {
    return document.body.classList.contains('vscode-dark') ? 'vs-dark' : 'vs-light';
}

window.addEventListener('DOMContentLoaded', () => {
    monacoInstance = monaco.editor.create(document.getElementById('editor')!, {
        language: 'python',
        value: '',
        readOnly: true,
        theme: getVsCodeTheme(),
        minimap: { enabled: false },
    });
    resizeHandler();
});

window.addEventListener('message', (event) => {
    const { command, view, content } = event.data || {};
    if (command === 'showView') {
        const effectiveView = view;
        showView(effectiveView, content);
    }
});

const resizeHandler = () => {
    // Resize Monaco Editor
    monacoInstance?.layout();
    panzoomFitCenter();
};
window.addEventListener('resize', resizeHandler);

// In showView, save the svgPanZoom instance
function showView(view: string, content: string) {
    const refreshVisibility = () => {
        const target_domid =
            view === ViewType.Pycode || view === ViewType.Pseudo ? 'editor' : view;
        ['loading', 'editor', 'preview', 'graph'].forEach((domid) => {
            const el = document.getElementById(domid);
            if (el) {
                el.style.display = domid === target_domid ? 'block' : 'none';
            }
        });
    };

    if (view === ViewType.Pycode || view === ViewType.Pseudo) {
        if (!monacoInstance) return;
        refreshVisibility();
        resizeHandler();

        monacoInstance.setValue(content);
        const model = monacoInstance.getModel();
        if (model) {
            try {
                monaco.editor.setModelLanguage(
                    model,
                    view === ViewType.Pycode ? 'python' : 'less',
                );
            } catch {
                // less will fail many times, this is expected
                // NOOP
            }
        }
    } else if (view === ViewType.Preview || view === ViewType.Graph) {
        const element = document.getElementById(view);
        if (element) {
            element.innerHTML = content ?? '';
            // requestAnimationFrame schedules a callback to run after the browser has painted the changes.
            requestAnimationFrame(() => {
                getPanZoom(false, element); // clear cache and re-init
                panzoomFitCenter();
            });
        }
    } else if (view === 'loading') {
        // Do nothing, just show the loading image
    }
    refreshVisibility();
    resizeHandler();
}

// Monaco Editor Web Worker fix for VS Code webview (local/offline)
self.MonacoEnvironment = {
    getWorkerUrl: function (moduleId, label) {
        const workerUrls = (window as any).workerUrls;
        // The worker files are output to dist/ by MonacoWebpackPlugin
        // Use the VS Code webview API to get the correct URI
        // You must pass the worker URL from your extension to the webview via postMessage or as a global variable
        // Example assumes you have a global variable set by your extension:
        return workerUrls[label] || workerUrls['default'];
    },
};

let _panzoomInstance: ReturnType<typeof svgPanZoom> | undefined = undefined;
function getPanZoom(allowcached = true, rootelem: HTMLElement | null = null) {
    if (rootelem === null) {
        const previewEl = document.getElementById('preview');
        const graphEl = document.getElementById('graph');

        if (previewEl?.style.display === 'block') {
            rootelem = previewEl;
        }
        if (graphEl?.style.display === 'block') {
            rootelem = graphEl;
        }
    }
    const svg = rootelem?.querySelector('svg');

    if (svg && (!_panzoomInstance || !allowcached)) {
        // requestAnimationFrame(() => {
        _panzoomInstance = svgPanZoom(svg, {
            panEnabled: true,
            zoomEnabled: true,
            controlIconsEnabled: true,
            fit: true,
            center: true,
            zoomScaleSensitivity: 0.4, // Lower = slower zoom, higher = faster (default is 0.2)
        });
    }
    return _panzoomInstance;
}

function panzoomFitCenter() {
    const instance = getPanZoom();
    if (instance) {
        try {
            instance.resize();
            instance.fit();
            instance.center();
        } catch {
            // NOOP
        }
    }
}
