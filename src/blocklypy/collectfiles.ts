import { IPyConverterFile } from 'blocklypy';
import * as vscode from 'vscode';

export async function checkExtraFilesForConversion(
    uri: vscode.Uri,
    file: IPyConverterFile,
) {
    const allFiles: IPyConverterFile[] = [file];

    // WEDO2.0 project file preview image: <project>.proj -> <project>/LobbyPreview.jpg
    if (uri.path.endsWith('.proj')) {
        const baseName = uri.path.replace(/\.proj$/, '');
        const imageName = `${baseName}/LobbyPreview.jpg`;
        const imageUri = vscode.Uri.file(imageName);
        try {
            const imageData = await vscode.workspace.fs.readFile(imageUri);
            allFiles.push({
                name: imageName,
                buffer: imageData.buffer as ArrayBuffer,
            });
        } catch (_e) {
            // Image not found, ignore
        }
    }
    return allFiles;
}
