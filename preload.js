const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveSession: (sessionData) => ipcRenderer.invoke('save-session', sessionData),
  getHistory: () => ipcRenderer.invoke('get-history'),
  exportHistory: () => ipcRenderer.invoke('export-history')
});
