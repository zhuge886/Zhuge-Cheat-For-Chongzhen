'use strict';

const path = require('path');
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { ByokProxy } = require('./proxy');
const {
  getPublicConfig,
  getRuntimeConfig,
  saveConfig
} = require('./config-manager');

let mainWindow = null;
const proxy = new ByokProxy();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 860,
    height: 820,
    minWidth: 760,
    minHeight: 680,
    title: 'Zhuge Cheat for Chongzhen',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

proxy.on('log', (entry) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('proxy:log', entry);
  }
});

ipcMain.handle('config:get', async () => getPublicConfig());

ipcMain.handle('config:save', async (_event, input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('配置格式无效。');
  }
  return saveConfig(input);
});

ipcMain.handle('log:choose-directory', async () => {
  const current = await getPublicConfig();
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择 Prompt 捕获目录',
    defaultPath: current.logDir,
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('log:open-directory', async () => {
  const current = await getPublicConfig();
  if (!current.logDir) throw new Error('尚未设置捕获目录。');
  const error = await shell.openPath(current.logDir);
  if (error) throw new Error(error);
  return true;
});

ipcMain.handle('proxy:start', async () => {
  const runtime = await getRuntimeConfig();
  return proxy.start(runtime);
});

ipcMain.handle('proxy:stop', async () => proxy.stop());
ipcMain.handle('proxy:status', async () => proxy.getStatus());

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', async () => {
  await proxy.stop();
  if (process.platform !== 'darwin') app.quit();
});
