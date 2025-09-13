let inErrorFrame = true;
let error: { filename: string; line: number; message: string } | null = null;
type ErrorCallback = (filename: string, line: number, message: string) => void;

export async function parsePythonError(text: string, onErrorCb?: ErrorCallback) {
    /*
            Find the traceback block:

            Traceback (most recent call last):
              File "__main__.py", line 9, in <module>
              File "test1.py", line 9, in <module>
            NameError: name 'PrimeHub2' isn't defined
        */
    const lines = text.split(/\r?\n/);
    lines.forEach((line) => {
        parsePythonErrorLine(line.replace(/[\r\n]$/, ''), onErrorCb);
    });
}

export async function parsePythonErrorLine(line: string, onErrorCb?: ErrorCallback) {
    if (inErrorFrame) {
        if (line.startsWith('Traceback (most recent call last):')) inErrorFrame = false;
        return;
    }

    const match = /^\s+File "([^"]+)", line (\d+), in .+/.exec(line);
    if (match)
        error = { filename: match[1], line: parseInt(match[2], 10) - 1, message: '' };
    else {
        if (!error) {
            inErrorFrame = false;
            console.warn('No error frame found before error message');
            return; // no stack frame yet, handle it gracefully
        }
        error.message = line.trim(); // message will be after the last stack frame

        const error_local = { ...error };
        if (onErrorCb)
            onErrorCb(error_local.filename, error_local.line, error_local.message);
        inErrorFrame = true;
        error = null;
    }
}

export function resetPythonErrorParser() {
    inErrorFrame = true;
    error = null;
}
