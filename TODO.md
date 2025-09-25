# Backlog and Refernces

## TODO items

- snippets
- USB connect EV3/Spike
- better compilation for LEGO files (get pybrick content / or switch to)
- add Traceback for LEGO files as well
- consider TextDocumentContentProvider
  <https://code.visualstudio.com/api/extension-guides/virtual-documents>
- consider fsprovider for multi views:
  <https://code.visualstudio.com/api/references/vscode-api#FileSystemProvider>
- web extension:
  <https://code.visualstudio.com/api/extension-guides/web-extensions>
- AI extensibility
  <https://code.visualstudio.com/api/extension-guides/ai/ai-extensibility-overview>
- implement pybricks auto complete for the pybricks python language
- characteristic.broadcast(broadcast[, callback(error)]); // broadcast is
  true|false
- characteristic.discoverDescriptors([callback(error, descriptors)]);
- nordic/uart?
- REPL
- logging and data export, maybe even graphing???
- log file activity panel / file
- create REPL notbook?
- generate svgs simply and show them as base editors?
- connect to standard LEGO hubs via BT, logging
  <https://lego.github.io/lego-ble-wireless-protocol-docs/>
- // TODO: handle disconnect and restart scanning!
- <https://code.visualstudio.com/api/ux-guidelines/panel>
- datalog through AppData send
- use debug console
- use @stoprocent/noble
- cancelled promise / debug
- clarify and handle licensing, adjust Apache and MIT - include pybricks,
  lego--vscode, pybricks-vscode projects

- feature: spike - clear slot/slots
- feature: spike - tunnel

- plot: ability to group metrics to same axis
- plot: spike / ability to select any DeviceNotificationPayload field (+optional
  port filter); allow group by uom?

## TO-FIX

- setState state handling is connected to all clients // should handle the
  active client and maybe ignore the others?

## SPIKE

- spike app.mpy + program.mpy needs to be uploaded?
- MoveSlotRequest slotNumberFrom/slotNumberTo
- ListPathRequest, DeletePathRequest, StartFileDownloadRequest MoveSlotRequest:
  72, MoveSlotResponse: 73, ListPathRequest: 74, ListPathResponse: 75,
  DeletePathRequest: 76, DeletePathResponse: 77

- !! move client / state handling to connmanager
- check usb with pyb!

- todo: handle COBS multiple messages when decoding

## Reference

- <https://code.visualstudio.com/api/references/contribution-points>
- <https://lego.github.io/spike-prime-docs/index.html>
- <https://lego.github.io/lego-ble-wireless-protocol-docs/>
