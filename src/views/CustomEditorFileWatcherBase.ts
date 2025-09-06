import * as vscode from 'vscode';
import { showError } from '../extension/diagnostics';

export abstract class CustomEditorFileWatcherBase {
    protected pollInterval?: NodeJS.Timeout;
    protected changeListener?: vscode.Disposable;
    protected disposeListener?: vscode.Disposable; // Store the dispose handler

    protected async monitorFileChanges(
        document: vscode.CustomDocument,
        webviewPanel: vscode.WebviewPanel | undefined,
        refreshCallback: () => Promise<void>,
        watchedUris?: Set<string>,
    ) {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }

        // Dispose previous dispose handler if present
        this.disposeListener?.dispose();

        // if the main file is in the workspace, only listen to workspace changes
        // otherwise, poll for all watched files
        const isMainInWorkspace = vscode.workspace.workspaceFolders?.some((folder) =>
            document.uri.fsPath.startsWith(folder.uri.fsPath),
        );
        if (watchedUris && watchedUris.size > 0) {
            // intentionally do not handle mixed workspace and non-workspace files, add a warning if mixed
            const workspaceFolders =
                vscode.workspace.workspaceFolders?.map((f) => f.uri.fsPath) ?? [];
            const hasNonWorkspaceWatched = Array.from(watchedUris).some((uriStr) => {
                const uri = vscode.Uri.parse(uriStr);
                return !workspaceFolders.some((folder) =>
                    uri.fsPath.startsWith(folder),
                );
            });
            if (isMainInWorkspace && hasNonWorkspaceWatched) {
                showError(
                    'Mixing workspace and non-workspace files for monitoring is not supported.',
                );
            }
        }

        if (isMainInWorkspace) {
            this.changeListener?.dispose();
            this.changeListener = vscode.workspace.onDidChangeTextDocument(
                async (e) => {
                    if (!watchedUris || watchedUris.has(e.document.uri.toString())) {
                        await refreshCallback();
                    }
                },
            );
        } else {
            // Use a map to track lastModified for each watched file
            const urisToWatch = [document.uri.toString()];
            if (watchedUris && watchedUris.size > 0) {
                urisToWatch.push(...Array.from(watchedUris));
            }
            const lastModified = new Map<string, number>();
            for (const uriStr of urisToWatch) {
                const uri = vscode.Uri.parse(uriStr);
                try {
                    const stat = await vscode.workspace.fs.stat(uri);
                    lastModified.set(uriStr, stat.mtime);
                } catch {
                    lastModified.set(uriStr, 0);
                }
            }

            let polling = false;
            this.pollInterval = setInterval(async () => {
                if (polling) return;
                polling = true;
                try {
                    let changed = false;
                    for (const uriStr of urisToWatch) {
                        const uri = vscode.Uri.parse(uriStr);
                        try {
                            const stat = await vscode.workspace.fs.stat(uri);
                            if (stat.mtime !== lastModified.get(uriStr)) {
                                lastModified.set(uriStr, stat.mtime);
                                changed = true;
                            }
                        } catch {
                            // File might have been deleted
                            if (lastModified.get(uriStr) !== 0) {
                                lastModified.set(uriStr, 0);
                                changed = true;
                            }
                        }
                    }
                    if (changed) {
                        await refreshCallback();
                    }
                } finally {
                    polling = false;
                }
            }, 2000);

            // Store the disposable for onDidDispose
            this.disposeListener = webviewPanel?.onDidDispose(() => {
                if (this.pollInterval) {
                    clearInterval(this.pollInterval);
                }
            });
        }
    }
}
