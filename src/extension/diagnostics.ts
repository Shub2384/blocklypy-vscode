import * as vscode from 'vscode';
import { MAIN_MODULE_PATH } from '../logic/compile';
import {
    BlocklypyViewer,
    BlocklypyViewerProvider,
} from '../views/BlocklypyViewerProvider';

const DiagnosticsCollection =
    vscode.languages.createDiagnosticCollection('BlocklyPy Pybricks');

export async function reportPythonError(
    filename: string,
    line: number,
    message: string,
) {
    const { editor, blviewer } = await findEditorForFile(filename);
    const active = editor ?? blviewer;
    if (!active) return;

    const range = new vscode.Range(line, 0, line, 100); // highlight the whole line
    const diagnostic = new vscode.Diagnostic(
        range,
        message,
        vscode.DiagnosticSeverity.Error,
    );
    DiagnosticsCollection.set(active.document.uri, [diagnostic]);

    if (editor) {
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
        editor.selection = new vscode.Selection(line, 0, line, 0);
    } else if (blviewer) {
        //blviewer.setErrorLine(line, message);
        // diagnostics change will reveal the line in the editor
    }
}

export async function clearPythonErrors() {
    DiagnosticsCollection.clear();
}

async function showEditorErrorDecoration(
    filename: string,
    line: number,
    errorMsg: string,
) {
    const { editor, blviewer } = await findEditorForFile(filename);
    const active = editor ?? blviewer;
    if (!active) return;
}

async function findEditorForFile(
    filename: string,
): Promise<{ editor?: vscode.TextEditor; blviewer?: BlocklypyViewer }> {
    if (filename === MAIN_MODULE_PATH) {
        return {
            editor: vscode.window.activeTextEditor,
            blviewer: BlocklypyViewerProvider.activeBlocklypyViewer,
        };
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
                            const editor = openEditor;
                            return { editor };
                        } else {
                            // Open the document if not visible
                            const editor = await vscode.workspace
                                .openTextDocument(tab.input.uri)
                                .then((doc) =>
                                    vscode.window.showTextDocument(doc, {
                                        preview: false,
                                    }),
                                );
                            return { editor };
                        }
                    }
                }
            }
        }
        return {};
    }
}

export function showInfo(message: string) {
    vscode.window?.showInformationMessage(message);
}
export function showWarning(message: string) {
    vscode.window?.showWarningMessage(message);
}
export function showError(message: string) {
    vscode.window?.showErrorMessage(message);
}
