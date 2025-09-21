type GraphvizModule = {
    dot: (input: string) => Promise<string>;
};

// const dependencygraph = result.dependencygraph;
// let graph: string | undefined = undefined;
// if (dependencygraph && typeof graphviz.dot === 'function') {

async function GraphvizLoader(): Promise<GraphvizModule | undefined> {
    if (instance) return instance;

    const { Graphviz } = await import('@hpcc-js/wasm-graphviz');
    const loaded = await Graphviz.load();
    if (loaded && typeof loaded.dot === 'function') {
        instance = loaded as unknown as GraphvizModule;
    }
    return instance;
}

let instance: GraphvizModule | undefined = undefined;

export default GraphvizLoader;
