import { app, BrowserWindow, ipcMain, session } from 'electron';
import * as path from 'path';
import type { DeviceInfo } from '../../shared/models/device';

const isDev = process.env.NODE_ENV === 'development';
let mainWindow: BrowserWindow | null = null;

const getHtmlPath = () => path.resolve(__dirname, '../../..', 'index.html');

const installDevTools = async (): Promise<void> => {
  if (!isDev) {
    return;
  }

  try {
    const { default: installExtension, REACT_DEVELOPER_TOOLS } = await import('electron-devtools-installer');
    const extensionName = await installExtension(REACT_DEVELOPER_TOOLS, {
      loadExtensionOptions: { allowFileAccess: true }
    });

    // electron-devtools-installer still uses the deprecated API internally, so we defensively re-load via the new API.
    const extensionInfo = session?.defaultSession?.getAllExtensions?.()?.find((ext) => ext.name === extensionName);
    if (extensionInfo?.path && session?.defaultSession?.extensions?.loadExtension) {
      await session.defaultSession.extensions.loadExtension(extensionInfo.path);
    }

    console.log(`Added Extension: ${extensionName}`);
  } catch (error) {
    console.error('Failed to install React DevTools:', error);
  }
};

const defaultDevices: DeviceInfo[] = [
  { id: 'Sensor-A', ownerLabel: null },
  { id: 'Sensor-B', ownerLabel: null },
  { id: 'Sensor-C', ownerLabel: 'Reserved (mock peer)' }
];

const deviceState: Record<string, DeviceInfo> = defaultDevices.reduce((acc, device) => {
  acc[device.id] = { ...device };
  return acc;
}, {} as Record<string, DeviceInfo>);

const snapshotDevices = (): DeviceInfo[] => Object.values(deviceState).map((device) => ({ ...device }));

const broadcastDevices = (): void => {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send('devices:update', snapshotDevices());
    }
  }
};

/**
 * Wire IPC channels used by the renderer to request and mutate devices.
 * We keep the list in-memory and push a full snapshot whenever something changes.
 */
const registerDeviceHandlers = (): void => {
  ipcMain.on('devices:request', (event) => {
    event.sender.send('devices:update', snapshotDevices());
  });

  ipcMain.on('devices:claim', (_event, deviceId: string) => {
    const device = deviceState[deviceId];
    if (device && !device.ownerLabel) {
      device.ownerLabel = 'This session';
      broadcastDevices();
    }
  });

  ipcMain.on('devices:release', (_event, deviceId: string) => {
    const device = deviceState[deviceId];
    if (device && device.ownerLabel === 'This session') {
      device.ownerLabel = null;
      broadcastDevices();
    }
  });
};

const createMainWindow = async (): Promise<void> => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true
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
 * Bootstraps the Electron app by installing DevTools (in dev),
 * and creating the main window.
 */
export const bootstrap = async (): Promise<void> => {
  if (isDev) {
    await installDevTools();
  }

  registerDeviceHandlers();

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

