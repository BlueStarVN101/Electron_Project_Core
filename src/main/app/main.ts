import { app, BrowserWindow, ipcMain, session } from 'electron';
import * as path from 'path';
import InstanceCoordinator from './instance-coordinator';
import type { InstanceState } from '../../shared/models/instance';
import { getTrackedUsbDevices } from '../preload/api/usb-devices';

const isDev = process.env.NODE_ENV === 'development';
let mainWindow: BrowserWindow | null = null;
let instanceCoordinator: InstanceCoordinator | null = null;

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
 * Create the renderer window, wire lifecycle events, and immediately push the latest
 * instance snapshot so the UI can render counts before live events arrive.
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

  if (instanceCoordinator) {
    const snapshot = await instanceCoordinator.getSnapshot();
    mainWindow.webContents.send('instance:state', snapshot);
  }

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
};

/**
 * Bridge renderer IPC calls onto the InstanceCoordinator and re-broadcast
 * leader state changes to every BrowserWindow.
 */
const registerInstanceHandlers = (coordinator: InstanceCoordinator): void => {
  ipcMain.handle('instance:get-state', () => coordinator.getSnapshot());
  ipcMain.handle('instance:claim-usb', (_event, deviceId: string) => coordinator.claimUsbDevice(deviceId ?? ''));
  ipcMain.handle('instance:release-usb', (_event, deviceId: string) => coordinator.releaseUsbDevice(deviceId ?? ''));

  coordinator.on('state-changed', (state: InstanceState) => {
    if (mainWindow?.isDestroyed()) {
      return;
    }

    mainWindow?.webContents.send('instance:state', state);
  });
};

/**
 * Bootstraps the Electron app by installing DevTools (in dev),
 * initializing the InstanceCoordinator once, and creating the main window.
 */
export const bootstrap = async (): Promise<void> => {
  if (isDev) {
    await installDevTools();
  }

  if (!instanceCoordinator) {
    instanceCoordinator = new InstanceCoordinator(app.getName());
    await instanceCoordinator.init();
    await instanceCoordinator.setUsbDevices(getTrackedUsbDevices());
    registerInstanceHandlers(instanceCoordinator);
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

app.once('before-quit', () => {
  instanceCoordinator?.dispose();
});

