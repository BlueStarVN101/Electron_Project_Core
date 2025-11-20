import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { RuntimeVersions } from '../../shared/models/runtime';
import type { InstanceState } from '../../shared/models/instance';

const getRuntimeVersions = (): RuntimeVersions => ({
  node: process.versions.node,
  chrome: process.versions.chrome,
  electron: process.versions.electron
});

const getInstanceState = async (): Promise<InstanceState | null> => {
  try {
    return await ipcRenderer.invoke('instance:get-state');
  } catch (error) {
    console.error('Failed to request instance state', error);
    return null;
  }
};

const subscribeToInstanceState = (callback: (state: InstanceState) => void): (() => void) => {
  const listener = (_event: IpcRendererEvent, state: InstanceState) => {
    callback(state);
  };

  ipcRenderer.on('instance:state', listener);

  return () => {
    ipcRenderer.removeListener('instance:state', listener);
  };
};

const invokeClaimUsb = async (): Promise<boolean> => ipcRenderer.invoke('instance:claim-usb');
const invokeReleaseUsb = async (): Promise<boolean> => ipcRenderer.invoke('instance:release-usb');

contextBridge.exposeInMainWorld('electronAPI', {
  getVersions: getRuntimeVersions,
  getInstanceState,
  onInstanceState: subscribeToInstanceState,
  claimUsbDevice: invokeClaimUsb,
  releaseUsbDevice: invokeReleaseUsb
});

