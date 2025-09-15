const os = require('os');

class EventEmitter {
    constructor() {
        this.event = jest.fn();
        this.fire = jest.fn();
        this.dispose = jest.fn();
    }
}

class TreeItem {
    constructor(label, collapsibleState) {
        this.label = label;
        this.collapsibleState = collapsibleState;
    }
}

class StatusBarItem {
    constructor() {
        this.text = '';
        this.tooltip = '';
        this.show = jest.fn();
        this.hide = jest.fn();
        this.dispose = jest.fn();
    }
}

const { EventEmitter: NodeEventEmitter } = require('events');

class _EventEmitter {
    constructor() {
        this._emitter = new NodeEventEmitter();
    }
    event(listener) {
        this._emitter.on('fire', listener);
        return {
            dispose: () => this._emitter.off('fire', listener),
        };
    }
    fire(data) {
        this._emitter.emit('fire', data);
    }
}

module.exports = {
    EventEmitter: _EventEmitter,
    workspace: {
        workspaceFolders: [{ uri: { fsPath: os.tmpdir() } }],
    },
    window: {
        activeTextEditor: {
            document: { uri: { fsPath: os.tmpdir() + '/testfile.py' } },
        },
        createStatusBarItem: jest.fn(() => new StatusBarItem()),
    },
    languages: {
        createDiagnosticCollection: jest.fn(() => ({
            set: jest.fn(),
            clear: jest.fn(),
            delete: jest.fn(),
            dispose: jest.fn(),
        })),
    },
    TreeItem,
};
