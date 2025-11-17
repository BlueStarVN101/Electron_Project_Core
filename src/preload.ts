import { contextBridge } from 'electron';

type VersionInfo = {
  node: string;
  chrome: string;
  electron: string;
};

contextBridge.exposeInMainWorld('electronAPI', {
  getVersions: (): VersionInfo => ({
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  })
});