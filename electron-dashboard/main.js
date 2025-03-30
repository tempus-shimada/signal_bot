const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');

let mainWindow; // Reference to the main window

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 600,         // Increased width for a wider window
    height: 700,        // Increased height so everything fits comfortably
    alwaysOnTop: true,
    // Uncomment the next line if you want a frameless window for a clean look:
    // frame: false,
    transparent: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  // Register global shortcuts using Control key.
  globalShortcut.register('Control+P', () => {
    mainWindow.webContents.send('hotkey-action', { action: 'prime' });
  });

  globalShortcut.register('Control+S', () => {
    mainWindow.webContents.send('hotkey-action', { action: 'signal' });
  });

  globalShortcut.register('Control+K', () => {
    mainWindow.webContents.send('hotkey-action', { action: 'close' });
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
