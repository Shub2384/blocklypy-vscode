import { parse, walk } from '@pybricks/python-program-analysis';
import path from 'path';
import * as vscode from 'vscode';

type Module = {
    name: string;
    path: string;
    content: string;
};

async function collectPythonModules(entryUri: vscode.Uri): Promise<Module[]> {
    const modules: Module[] = [];
    const checkedModules = new Set<string>();
    const openDocs = vscode.workspace.textDocuments;

    // Helper to get file content from open editors or workspace
    async function getModuleContent(
        modulePath: string,
        _folder: string,
    ): Promise<string | undefined> {
        // Try open editors first
        for (const doc of openDocs) {
            if (doc.uri.fsPath === modulePath) {
                return doc.getText();
            }
        }
        // Try workspace
        try {
            const uri = vscode.Uri.file(modulePath);
            const stats = await vscode.workspace.fs.stat(uri);
            if (stats.type === vscode.FileType.File) {
                const buffer = await vscode.workspace.fs.readFile(uri);
                return Buffer.from(buffer).toString('utf8');
            }
        } catch {
            // File not found
        }
        return undefined;
    }

    // Recursive function to collect modules
    async function collect(uri: vscode.Uri, name: string) {
        if (checkedModules.has(name)) return;
        checkedModules.add(name);

        const folder = path.dirname(uri.fsPath);
        const content = await getModuleContent(uri.fsPath, folder);
        if (!content) return;

        modules.push({ name, path: uri.fsPath, content });

        const tree = parse(content);
        const importedModules = new Set<string>();
        walk(tree, {
            onEnterNode(node) {
                if (node.type === 'import') {
                    for (const n of node.names) importedModules.add(n.path);
                } else if (node.type === 'from') {
                    importedModules.add(node.base);
                }
            },
        });

        for (const importedModule of importedModules) {
            // Resolve module path
            const relativePath = importedModule.replace(/\./g, path.sep) + '.py';
            const absolutePath = path.join(folder, relativePath);
            await collect(vscode.Uri.file(absolutePath), importedModule);
        }
    }

    await collect(entryUri, '__main__');
    return modules;
}

export { collectPythonModules };
