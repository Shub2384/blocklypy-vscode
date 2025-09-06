async function GraphvizLoader() {
    if (!instance) {
        const { Graphviz } = await import('@hpcc-js/wasm-graphviz');
        instance = await Graphviz.load();
    }
    return instance;
}

let instance: any = undefined;

export default GraphvizLoader;
