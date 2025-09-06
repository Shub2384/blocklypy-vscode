import * as vscode from 'vscode';
import { MAIN_MOCULE_PATH } from '../logic/compile';

const DiagnosticsCollection =
    vscode.languages.createDiagnosticCollection('BlocklyPy Pybricks');

const decorationType = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    borderColor: 'red',
    borderStyle: 'solid',
    borderWidth: '0 0 2px 0',
    overviewRulerColor: 'red',
    overviewRulerLane: vscode.OverviewRulerLane.Full,
});

export async function reportPythonError(
    file: string | vscode.TextEditor,
    line: number,
    message: string,
) {
    const editor = typeof file === 'object' ? file : await findEditorForFile(file);
    if (!editor) {
        return;
    }

    const range = new vscode.Range(line, 0, line, 100); // highlight the whole line
    const diagnostic = new vscode.Diagnostic(
        range,
        message,
        vscode.DiagnosticSeverity.Error,
    );
    DiagnosticsCollection.set(editor.document.uri, [diagnostic]);

    await showEditorErrorDecoration(editor.document.fileName, line, message);
}

export async function clearPythonErrors() {
    DiagnosticsCollection.clear();
    await clearEditorErrorDecorations();
}

async function clearEditorErrorDecorations() {
    for (const group of vscode.window.tabGroups.all) {
        group.tabs.forEach((tab) => {
            if (tab.input instanceof vscode.TabInputText) {
                const fileName = tab.input.uri.fsPath;
                const openEditor = vscode.window.visibleTextEditors.find(
                    (ed) => ed.document.fileName === fileName,
                );
                openEditor?.setDecorations(decorationType, []);
            }
        });
    }
}

async function showEditorErrorDecoration(
    filename: string,
    line: number,
    errorMsg: string,
) {
    const editor = await findEditorForFile(filename);
    if (!editor) {
        return;
    }

    const range = new vscode.Range(line, 0, line, 0);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
    editor.selection = new vscode.Selection(line, 0, line, 0);
    editor.setDecorations(decorationType, [{ range, hoverMessage: errorMsg }]);
}

async function findEditorForFile(
    filename: string,
): Promise<vscode.TextEditor | undefined> {
    if (filename === MAIN_MOCULE_PATH) {
        return vscode.window.activeTextEditor;
    } else {
        // Check all open tabs in all tab groups
        for (const group of vscode.window.tabGroups.all) {
            for (const tab of group.tabs) {
                if (tab.input instanceof vscode.TabInputText) {
                    const fileName = tab.input.uri.fsPath;
                    if (fileName.endsWith(filename)) {
                        // Try to find a visible editor for this tab
                        const openEditor = vscode.window.visibleTextEditors.find(
                            (ed) => ed.document.fileName === fileName,
                        );
                        if (openEditor) {
                            return openEditor;
                        } else {
                            // Open the document if not visible
                            return await vscode.workspace
                                .openTextDocument(tab.input.uri)
                                .then((doc) =>
                                    vscode.window.showTextDocument(doc, {
                                        preview: false,
                                    }),
                                );
                        }
                    }
                }
            }
        }
    }
}

export function showInfo(message: string) {
    vscode.window.showInformationMessage(message);
}
export function showError(message: string) {
    vscode.window.showErrorMessage(message);
}
