import { compile } from '@pybricks/mpy-cross-v6';
import { parse, walk } from '@pybricks/python-program-analysis';
import path from 'path';
import * as vscode from 'vscode';
import { BlocklypyViewerProvider } from '../views/BlocklypyViewerProvider';
import { setState, StateProp } from './state';

export const MAIN_MODULE = '__main__';
export const MAIN_MODULE_PATH = '__main__.py';

type Module = {
    name: string;
    path: string;
    content: string;
};

function getPythonCode(): { content: string; folder?: string } | undefined {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        const content = editor.document.getText();
        const folder = path.dirname(editor.document.uri.fsPath);
        return { content, folder };
    }

    const customViewer = BlocklypyViewerProvider.activeBlocklypyViewer;
    if (customViewer) {
        const content = customViewer?.content?.pycode ?? '';
        return { content };
    }
}

export async function compileAsync(...args: any[]): Promise<Blob> {
    await vscode.commands.executeCommand('workbench.action.files.saveAll');

    const parts: BlobPart[] = [];

    setState(StateProp.Compiling, true);
    try {
        const pycode = getPythonCode();
        if (!pycode) throw new Error('No Python code available to compile.');

        const modules: Module[] = [
            {
                name: MAIN_MODULE,
                path: MAIN_MODULE_PATH,
                content: pycode.content,
            },
        ];

        const checkedModules = new Set<string>();
        while (modules.length > 0) {
            const module = modules.pop()!;
            if (checkedModules.has(module.name)) {
                continue;
            }
            checkedModules.add(module.name);

            // console.log(`Compiling module: ${module.name} (${module.path})`);
            const importedModules = findImportedModules(module.content);
            for (const importedModule of importedModules) {
                if (checkedModules.has(importedModule) || !pycode.folder) {
                    continue;
                }
                const resolvedModule = await resolveModuleAsync(
                    pycode.folder,
                    importedModule,
                );
                if (resolvedModule) {
                    modules.push(resolvedModule);
                } else {
                    checkedModules.add(importedModule);
                }
            }

            // compile module
            const [status, mpy] = await compileInternal(
                module.path,
                module.name,
                module.content,
            );
            if (status !== 0 || !mpy)
                throw new Error(`Failed to compile ${module.name}`);

            parts.push(encodeUInt32LE(mpy.length));
            parts.push(cString(module.name) as BlobPart);
            parts.push(mpy as BlobPart);

            checkedModules.add(module.name);
        }
    } catch (e) {
        console.error(e);
    } finally {
        setState(StateProp.Compiling, false);
    }

    return new Blob(parts);
}

async function compileInternal(
    path: string,
    name: string,
    content: string,
): Promise<[number, Uint8Array | undefined]> {
    // HACK: This is a workaround for https://github.com/pybricks/support/issues/2185
    const fetch_backup = (global as any).fetch;
    (global as any).fetch = undefined;
    const compiled = await compile(path, content, undefined, undefined)
        .catch((e) => {
            console.error(`Failed to compile ${name}: ${e}`);
            return { status: 1, mpy: undefined };
        })
        .finally(() => {
            (global as any).fetch = fetch_backup;
        });

    return [compiled.status, compiled.mpy];
}

async function resolveModuleAsync(
    folder: string,
    module: string,
): Promise<Module | undefined> {
    const relativePath = module.replace(/\./g, path.sep) + '.py';
    let absolutePath = path.join(folder, relativePath);
    try {
        const uri = vscode.Uri.file(absolutePath);
        const stats = await vscode.workspace.fs.stat(uri);
        if (stats.type === vscode.FileType.File) {
            return {
                name: module,
                path: relativePath,
                content: Buffer.from(await vscode.workspace.fs.readFile(uri)).toString(
                    'utf8',
                ),
            };
        }
    } catch {}
}

const encoder = new TextEncoder();

function cString(str: string): Uint8Array {
    return encoder.encode(str + '\x00');
}

function encodeUInt32LE(value: number): ArrayBuffer {
    const buf = new ArrayBuffer(4);
    const view = new DataView(buf);
    view.setUint32(0, value, true);
    return buf;
}

function findImportedModules(py: string): ReadonlySet<string> {
    const modules = new Set<string>();

    const tree = parse(py);

    walk(tree, {
        onEnterNode(node, _ancestors) {
            if (node.type === 'import') {
                for (const name of node.names) {
                    modules.add(name.path);
                }
            } else if (node.type === 'from') {
                modules.add(node.base);
            }
        },
    });

    return modules;
}
