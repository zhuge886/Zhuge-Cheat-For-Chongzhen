'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('zhugeProxy', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (config) => ipcRenderer.invoke('config:save', config),
  chooseLogDir: () => ipcRenderer.invoke('log:choose-directory'),
  openLogDir: () => ipcRenderer.invoke('log:open-directory'),
  startProxy: () => ipcRenderer.invoke('proxy:start'),
  stopProxy: () => ipcRenderer.invoke('proxy:stop'),
  getStatus: () => ipcRenderer.invoke('proxy:status'),
  onLog: (callback) => {
    const listener = (_event, entry) => callback(entry);
    ipcRenderer.on('proxy:log', listener);
    return () => ipcRenderer.removeListener('proxy:log', listener);
  }
});
