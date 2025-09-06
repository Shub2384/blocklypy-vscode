import svgPanZoom from 'svg-pan-zoom';

window.addEventListener('DOMContentLoaded', () => {
    getSvgPanZoomInstance();
});

let svgPanZoomInstance_: ReturnType<typeof svgPanZoom> | undefined = undefined;
function getSvgPanZoomInstance() {
    const element = document.getElementById('graph-container');
    const svg = element?.querySelector('svg');
    if (svg) {
        requestAnimationFrame(() => {
            svgPanZoomInstance_ = svgPanZoom(svg, {
                panEnabled: true,
                zoomEnabled: true,
                controlIconsEnabled: true,
                fit: true,
                center: true,
                zoomScaleSensitivity: 0.4, // Lower = slower zoom, higher = faster (default is 0.2)
            });
        });
    }
    return svgPanZoomInstance_;
}

window.addEventListener('resize', () => {
    // Resize svg-pan-zoom
    // Find the currently visible SVG
    const instance = getSvgPanZoomInstance();
    if (instance) {
        instance.resize();
        instance.fit();
        instance.center();
    }
});

window.addEventListener('message', (event) => {
    const { command, content } = event.data || {};
    if (command === 'setContent') {
        setContent(content);
    }
});

function setContent(data: string) {
    const element = document.getElementById('graph-container');
    const svg = element?.querySelector('svg');
    if (svg) {
        svg.remove();
    }
    if (element) {
        element.innerHTML = data ?? '';
    }
    svgPanZoomInstance_ = undefined;
    const instance = getSvgPanZoomInstance();
    if (instance) {
        instance.resize();
        instance.fit();
        instance.center();
    }
}
