const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveSession: (sessionData) => ipcRenderer.invoke('save-session', sessionData),
  getHistory: () => ipcRenderer.invoke('get-history'),
  exportHistory: () => ipcRenderer.invoke('export-history'),
  autoSave: (sessionData) => ipcRenderer.invoke('auto-save-session', sessionData),
  clearTemp: () => ipcRenderer.invoke('clear-temp-session'),
  checkRecovery: () => ipcRenderer.invoke('check-recovery')
});
