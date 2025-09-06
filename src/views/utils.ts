let cachedGraphvizClass: any = undefined;
export async function GraphvizClass() {
    if (!cachedGraphvizClass) {
        const { Graphviz } = await import('@hpcc-js/wasm-graphviz');
        cachedGraphvizClass = await Graphviz.load();
    }
    return cachedGraphvizClass;
}
