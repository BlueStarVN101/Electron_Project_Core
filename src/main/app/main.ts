import { app, BrowserWindow, session } from 'electron';
import * as path from 'path';

const isDev = process.env.NODE_ENV === 'development';
let mainWindow: BrowserWindow | null = null;

const getPreloadPath = () => path.join(__dirname, '../preload/index.js');
const getHtmlPath = () => path.resolve(__dirname, '../../..', 'index.html');

const installDevTools = async (): Promise<void> => {
  try {
    const { default: installExtension, REACT_DEVELOPER_TOOLS } = await import('electron-devtools-installer');
    const extensionPath = await installExtension(REACT_DEVELOPER_TOOLS, false);
    // Use the new API to load the extension
    const extension = await session.defaultSession.extensions.loadExtension(extensionPath);
    console.log(`Added Extension: ${extension.name}`);
  } catch (error) {
    console.error('Failed to install React DevTools:', error);
  }
};

/**
 * Create the main renderer window and wire up lifecycle events.
 */
const createMainWindow = async (): Promise<void> => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  await mainWindow.loadFile(getHtmlPath());

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
};

/**
 * Bootstraps the Electron app by installing DevTools (in dev) and creating the window.
 */
export const bootstrap = async (): Promise<void> => {
  if (isDev) {
    await installDevTools();
  }

  await createMainWindow();
};

export const handleActivate = (): void => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createMainWindow();
  }
};

export const handleWindowAllClosed = (): void => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
};

