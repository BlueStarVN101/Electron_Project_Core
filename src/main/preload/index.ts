import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { RuntimeVersions } from '../../shared/models/runtime';
import type { InstanceState } from '../../shared/models/instance';

/**
 * The basic preload bridge we already had that exposes runtime version info.
 */
const getRuntimeVersions = (): RuntimeVersions => ({
  node: process.versions.node,
  chrome: process.versions.chrome,
  electron: process.versions.electron
});

/**
 * Request a one-time snapshot from the main process.
 */
const getInstanceState = async (): Promise<InstanceState | null> => {
  try {
    return await ipcRenderer.invoke('instance:get-state');
  } catch (error) {
    console.error('Failed to request instance state', error);
    return null;
  }
};

/**
 * Subscribe to push updates; returns an unsubscribe hook so React can clean up.
 */
const subscribeToInstanceState = (callback: (state: InstanceState) => void): (() => void) => {
  const listener = (_event: IpcRendererEvent, state: InstanceState) => {
    callback(state);
  };

  ipcRenderer.on('instance:state', listener);

  return () => {
    ipcRenderer.removeListener('instance:state', listener);
  };
};

const invokeClaimUsb = async (deviceId: string): Promise<boolean> => ipcRenderer.invoke('instance:claim-usb', deviceId);
const invokeReleaseUsb = async (deviceId: string): Promise<boolean> =>
  ipcRenderer.invoke('instance:release-usb', deviceId);

contextBridge.exposeInMainWorld('electronAPI', {
  getVersions: getRuntimeVersions,
  getInstanceState,
  onInstanceState: subscribeToInstanceState,
  claimUsbDevice: invokeClaimUsb,
  releaseUsbDevice: invokeReleaseUsb
});

