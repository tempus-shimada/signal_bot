const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onHotkeyAction: (callback) => ipcRenderer.on('hotkey-action', callback)
});
