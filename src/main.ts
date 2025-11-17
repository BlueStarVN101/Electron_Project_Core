import { app, BrowserWindow } from 'electron';
import * as path from 'path';

const isDev = process.env.NODE_ENV === 'development';
let mainWindow: BrowserWindow | null = null;

const createMainWindow = async (): Promise<void> => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  await mainWindow.loadFile(path.join(__dirname, '../index.html'));

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
};

const installDevTools = async (): Promise<void> => {
  try {
    const { default: installExtension, REACT_DEVELOPER_TOOLS } = await import('electron-devtools-installer');
    const name = await installExtension(REACT_DEVELOPER_TOOLS);
    console.log(`Added Extension: ${name}`);
  } catch (error) {
    console.error('Failed to install React DevTools:', error);
  }
};

const bootstrap = async (): Promise<void> => {
  if (isDev) {
    await installDevTools();
  }

  await createMainWindow();
};

app.whenReady().then(bootstrap).catch((error) => {
  console.error('Failed to bootstrap the application:', error);
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createMainWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
