let inErrorFrame = true;
let currentErrorFrame: { filename: string; line: number; message: string } | null =
    null;
type ErrorCallback = (filename: string, line: number, message: string) => void;

export async function parsePythonError(text: string, onErrorCb?: ErrorCallback) {
    /*
            Find the traceback block:

            Traceback (most recent call last):
              File "__main__.py", line 9, in <module>
              File "test1.py", line 9, in <module>
            NameError: name 'PrimeHub2' isn't defined
        */
    const lines = text.trimEnd().split(/\r?\n/);
    lines.forEach((line) => {
        parsePythonErrorLine(line.replace(/[\r\n]$/, ''), onErrorCb);
    });
}

export async function parsePythonErrorLine(line: string, onErrorCb?: ErrorCallback) {
    if (!inErrorFrame) {
        if (line.startsWith('Traceback (most recent call last):')) inErrorFrame = true;
        return;
    }

    const match = /^\s+File "([^"]+)", line (\d+), in .+/.exec(line);
    if (match)
        currentErrorFrame = {
            filename: match[1],
            line: parseInt(match[2], 10) - 1,
            message: '',
        };
    else {
        if (!currentErrorFrame) {
            inErrorFrame = false;
            console.warn('No error frame found before error message');
            return; // no stack frame yet, handle it gracefully
        }
        currentErrorFrame.message = line.trim(); // message will be after the last stack frame

        const error_local = { ...currentErrorFrame };
        if (onErrorCb)
            onErrorCb(error_local.filename, error_local.line, error_local.message);
        inErrorFrame = true;
        currentErrorFrame = null;
    }
}

export function resetPythonErrorParser() {
    inErrorFrame = false;
    currentErrorFrame = null;
}
