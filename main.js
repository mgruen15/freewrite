const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    frame: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#fcfbfa',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // mainWindow.webContents.openDevTools();
}

ipcMain.handle('save-session', async (event, sessionData) => {
  const userDataPath = app.getPath('userData');
  const userHistoryPath = path.join(userDataPath, 'history.json');
  const repoHistoryPath = path.join(__dirname, 'history.json');
  
  const saveToPath = (historyPath) => {
    let history = [];
    if (fs.existsSync(historyPath)) {
      try {
        const data = fs.readFileSync(historyPath, 'utf8');
        history = JSON.parse(data);
      } catch (e) {
        console.error(`Failed to parse ${historyPath}`, e);
      }
    }
    history.push(sessionData);
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
  };

  saveToPath(userHistoryPath);
  saveToPath(repoHistoryPath);
  
  return { success: true };
});

ipcMain.handle('get-history', async () => {
  const repoHistoryPath = path.join(__dirname, 'history.json');
  if (fs.existsSync(repoHistoryPath)) {
    try {
      const data = fs.readFileSync(repoHistoryPath, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      console.error('Failed to read history.json', e);
      return [];
    }
  }
  return [];
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
