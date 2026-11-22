const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (p) => ipcRenderer.invoke('settings:save', p),
  analyze: (text) => ipcRenderer.invoke('ai:analyze', text),
  openExternal: (url) => ipcRenderer.invoke('open:external', url)
});
