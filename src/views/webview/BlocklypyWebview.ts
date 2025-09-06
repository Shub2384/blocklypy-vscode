/**
 * This is the script for the BlocklyPy webview.
 * It is compiled separately from the main extension code.
 * See tsconfig.webview.json and .vscode/tasks.json.
 */

import svgPanZoom from 'svg-pan-zoom';
import * as monaco from 'monaco-editor';

declare const acquireVsCodeApi: any;
const vscode = acquireVsCodeApi();

let monacoEditor: monaco.editor.IStandaloneCodeEditor | undefined = undefined;

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
    monacoEditor = monaco.editor.create(document.getElementById('editor')!, {
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

let svgPanZoomInstance: ReturnType<typeof svgPanZoom> | undefined = undefined;

const resizeHandler = () => {
    // Resize Monaco Editor
    monacoEditor?.layout();

    // Resize svg-pan-zoom
    // Find the currently visible SVG
    const previewEl = document.getElementById('preview');
    const graphEl = document.getElementById('graph');
    const svgEl =
        (previewEl &&
            previewEl.style.display === 'block' &&
            previewEl.querySelector('svg')) ||
        (graphEl && graphEl.style.display === 'block' && graphEl.querySelector('svg'));

    if (svgEl && svgPanZoomInstance) {
        // svg-pan-zoom doesn't have a direct resize method, but you can call 'resize' and 'fit'
        svgPanZoomInstance.resize();
        svgPanZoomInstance.fit();
        svgPanZoomInstance.center();
    }
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
        if (!monacoEditor) {
            return;
        }
        refreshVisibility();
        resizeHandler();

        monacoEditor.setValue(content);
        const model = monacoEditor.getModel();
        if (model) {
            monaco.editor.setModelLanguage(
                model,
                view === ViewType.Pycode ? 'python' : 'less',
            );
        }
    } else if (view === ViewType.Preview || view === ViewType.Graph) {
        const element = document.getElementById(view);
        if (element) {
            element.innerHTML = content ?? '';

            // If SVG, enable pan/zoom
            const svgEl = element.querySelector('svg');
            if (svgEl) {
                requestAnimationFrame(() => {
                    svgPanZoomInstance = svgPanZoom(svgEl, {
                        panEnabled: true,
                        zoomEnabled: true,
                        controlIconsEnabled: true,
                        fit: true,
                        center: true,
                        zoomScaleSensitivity: 1.0, // Lower = slower zoom, higher = faster (default is 0.2)
                    });
                });
            }
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
