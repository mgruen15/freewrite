const { app, BrowserWindow, ipcMain, dialog } = require('electron');
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

ipcMain.handle('export-history', async (event) => {
  const repoHistoryPath = path.join(__dirname, 'history.json');
  let history = [];
  
  if (fs.existsSync(repoHistoryPath)) {
    try {
      const data = fs.readFileSync(repoHistoryPath, 'utf8');
      history = JSON.parse(data);
    } catch (e) {
      console.error('Failed to read history.json', e);
      return { success: false, error: 'Failed to read history' };
    }
  }

  if (history.length === 0) {
    return { success: false, error: 'No history to export' };
  }

  // Sort by timestamp descending
  history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const { filePath } = await dialog.showSaveDialog({
    title: 'Export History',
    defaultPath: path.join(app.getPath('documents'), `freewrite-export-${new Date().toISOString().split('T')[0]}.md`),
    filters: [
      { name: 'Markdown', extensions: ['md'] },
      { name: 'PDF Document', extensions: ['pdf'] },
      { name: 'Text File', extensions: ['txt'] }
    ]
  });

  if (!filePath) return { success: false, cancelled: true };

  const isPDF = filePath.toLowerCase().endsWith('.pdf');

  try {
    if (isPDF) {
      // Generate HTML for PDF
      let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #333; line-height: 1.6; }
            h1 { font-weight: 300; border-bottom: 1px solid #eee; padding-bottom: 10px; }
            h2 { font-weight: 400; margin-top: 40px; color: #555; }
            .meta { color: #888; font-size: 0.9em; margin-bottom: 20px; }
            .session { margin-bottom: 60px; page-break-inside: avoid; }
            .body { white-space: pre-wrap; font-family: "Georgia", serif; font-size: 1.1em; }
            hr { border: 0; border-top: 1px solid #eee; margin: 40px 0; }
          </style>
        </head>
        <body>
          <h1>Freewrite History Export</h1>
          <div class="meta">
            Generated on: ${new Date().toLocaleString()}<br>
            Total sessions: ${history.length}
          </div>
      `;

      history.forEach(session => {
        const date = new Date(session.timestamp).toLocaleString();
        htmlContent += `
          <div class="session">
            <h2>Session: ${date}</h2>
            <div class="meta">
              Word Count: ${session.word_count} | 
              Duration: ${session.duration_minutes.actual}m (planned: ${session.duration_minutes.planned}m)
              ${session.tags && session.tags.length > 0 ? `<br>Tags: ${session.tags.join(', ')}` : ''}
            </div>
            ${session.summary ? `<h3>Summary</h3><p>${session.summary}</p>` : ''}
            <h3>Body</h3>
            <div class="body">${session.body}</div>
          </div>
          <hr>
        `;
      });

      htmlContent += '</body></html>';

      // Create a hidden window to render the PDF
      const workerWindow = new BrowserWindow({
        show: false,
        webPreferences: { nodeIntegration: false }
      });

      await workerWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
      const data = await workerWindow.webContents.printToPDF({
        printBackground: true,
        margins: { top: 0, bottom: 0, left: 0, right: 0 }
      });
      
      fs.writeFileSync(filePath, data);
      workerWindow.close();
    } else {
      // Format as Markdown/Text
      let content = '# Freewrite History Export\n\n';
      content += `Generated on: ${new Date().toLocaleString()}\n`;
      content += `Total sessions: ${history.length}\n\n`;
      content += '---\n\n';

      history.forEach(session => {
        const date = new Date(session.timestamp).toLocaleString();
        content += `## Session: ${date}\n\n`;
        content += `- **Word Count:** ${session.word_count}\n`;
        content += `- **Duration:** ${session.duration_minutes.actual}m (planned: ${session.duration_minutes.planned}m)\n`;
        
        if (session.tags && session.tags.length > 0) {
          content += `- **Tags:** ${session.tags.join(', ')}\n`;
        }
        
        if (session.summary) {
          content += `\n### Summary\n${session.summary}\n`;
        }

        content += `\n### Body\n\n${session.body}\n\n`;
        content += '---\n\n';
      });

      fs.writeFileSync(filePath, content);
    }
    return { success: true, filePath };
  } catch (e) {
    console.error('Export failed', e);
    return { success: false, error: e.message };
  }
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
