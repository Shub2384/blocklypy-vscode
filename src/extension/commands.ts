// Define the BlocklyPyCommand enum for all command strings
export enum Commands {
    ConnectDevice = 'blocklypy-vscode.connectDevice',
    ConnectDeviceLastConnected = 'blocklypy-vscode.connectDeviceLastConnected',
    DisconnectDevice = 'blocklypy-vscode.disconnectDevice',
    CompileAndRun = 'blocklypy-vscode.compileAndRun',
    StartUserProgram = 'blocklypy-vscode.startUserProgram',
    StopUserProgram = 'blocklypy-vscode.stopUserProgram',
    StatusPlaceHolder = 'blocklypy-vscode.statusPlaceholder',
    ToggleAutoConnect = 'blocklypy-vscode.toggleAutoConnect',
    ToggleAutoStart = 'blocklypy-vscode.toggleAutoStart',
    DisplayNextView = 'blocklypy-vscode.blocklypyViewer.displayNextView',
    DisplayPreviousView = 'blocklypy-vscode.blocklypyViewer.displayPreviousView',
    DisplayPreview = 'blocklypy-vscode.blocklypyViewer.displayPreview',
    DisplayPycode = 'blocklypy-vscode.blocklypyViewer.displayPycode',
    DisplayPseudo = 'blocklypy-vscode.blocklypyViewer.displayPseudo',
    DisplayGraph = 'blocklypy-vscode.blocklypyViewer.displayGraph',
    showPythonPreview = 'blocklypy-vscode.showPythonPreview',
}
