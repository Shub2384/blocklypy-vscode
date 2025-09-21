import { parsePythonError, resetPythonErrorParser } from './stdout-python-error-helper';

const reportPythonError = jest.fn();

describe('parsePythonError', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        resetPythonErrorParser();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should not report if no traceback', () => {
        parsePythonError('No error here', reportPythonError);
        jest.runAllTimers();
        expect(reportPythonError).not.toHaveBeenCalled();
    });

    it('should report python error with correct filename, line, and message', () => {
        const errorText = `
    Traceback (most recent call last):
      File "__main__.py", line 9, in <module>
      File "test1.py", line 9, in <module>
    NameError: name 'PrimeHub2' isn't defined
            `.trim();
        parsePythonError(errorText, reportPythonError);
        jest.runAllTimers();
        expect(reportPythonError).toHaveBeenCalledWith(
            'test1.py',
            8, // line number is 9 - 1
            "NameError: name 'PrimeHub2' isn't defined",
        );
    });

    it('should handle multiple stack frames and pick the last one', () => {
        const errorText = `
    Traceback (most recent call last):
      File "__main__.py", line 5, in <module>
      File "test2.py", line 12, in <module>
      File "test3.py", line 20, in <module>
    TypeError: unsupported operand type(s)
            `.trim();
        parsePythonError(errorText, reportPythonError);
        jest.runAllTimers();
        expect(reportPythonError).toHaveBeenCalledWith(
            'test3.py',
            19,
            'TypeError: unsupported operand type(s)',
        );
    });

    it('should not report if error message or filename is missing', () => {
        const errorText = `
    Traceback (most recent call last):
      File "__main__.py", line 5, in <module>
            `.trim();
        parsePythonError(errorText, reportPythonError);
        jest.runAllTimers();
        expect(reportPythonError).not.toHaveBeenCalled();
    });

    it('should report even if message comes in multiple lines', () => {
        const errorText = `
Traceback (most recent call last):
  File "__main__.py", line 9, in <module>
  File "test1.py", line 9, in <module>
NameError: name 'PrimeHub2' isn't defined
        `.trim();
        const lines = errorText.split('\n');
        lines.forEach((line) => {
            parsePythonError(line, reportPythonError);
        });
        jest.runAllTimers();
        expect(reportPythonError).toHaveBeenCalled();
    });
});
