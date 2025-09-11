import { reportPythonError } from '../extension/diagnostics';

export async function handlePythonError(text: string) {
    /*
            Find the traceback block:
            Traceback (most recent call last):
              File "__main__.py", line 9, in <module>
              File "test1.py", line 9, in <module>
            NameError: name 'PrimeHub2' isn't defined
        */
    const lines = text.split(/\r?\n/);
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('Traceback (most recent call last):')) {
            start = i;
            break;
        }
    }
    if (start === -1) {
        return;
    }
    // Collect traceback lines
    let end = start + 1;
    while (end < lines.length && /^\s+File ".+", line \d+, in .+/.test(lines[end])) {
        end++;
    }
    // The error message is the next non-empty, non-indented line
    while (end < lines.length && lines[end].trim() === '') {
        end++;
    }
    if (end >= lines.length) {
        return;
    }

    const errorMsg = lines[end].trim();
    // Find the last stack frame
    let filename = '';
    let line = 0;
    for (let i = end - 1; i > start; i--) {
        const match = /^\s+File "([^"]+)", line (\d+), in .+/.exec(lines[i]);
        if (match) {
            filename = match[1];
            line = parseInt(match[2], 10) - 1;
            break;
        }
    }
    if (!filename || !errorMsg) {
        return;
    }

    await reportPythonError(filename, line, errorMsg);
}
