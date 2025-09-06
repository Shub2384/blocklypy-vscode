// Define the PybricksCommand enum for all command strings
export enum PybricksCommand {
    ConnectDevice = 'pybricks.connectDevice',
    ConnectDeviceLastConnected = 'pybricks.connectDeviceLastConnected',
    DisconnectDevice = 'pybricks.disconnectDevice',
    CompileAndRun = 'pybricks.compileAndRun',
    StartUserProgram = 'pybricks.startUserProgram',
    StopUserProgram = 'pybricks.stopUserProgram',
    StatusPlaceHolder = 'pybricks.statusPlaceholder',
    ToggleAutoConnect = 'pybricks.toggleAutoConnect',
    ToggleAutoStart = 'pybricks.toggleAutoStart',
    DisplayNextView = 'pybricks.blocklypyViewer.displayNextView',
    DisplayPreviousView = 'pybricks.blocklypyViewer.displayPreviousView',
    DisplayPreview = 'pybricks.blocklypyViewer.displayPreview',
    DisplayPycode = 'pybricks.blocklypyViewer.displayPycode',
    DisplayPseudo = 'pybricks.blocklypyViewer.displayPseudo',
    DisplayGraph = 'pybricks.blocklypyViewer.displayGraph',
    showPythonPreview = 'pybricks.showPythonPreview',
}
