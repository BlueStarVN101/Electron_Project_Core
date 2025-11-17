import { contextBridge } from 'electron';
import type { RuntimeVersions } from '../../shared/models/runtime';

const getRuntimeVersions = (): RuntimeVersions => ({
  node: process.versions.node,
  chrome: process.versions.chrome,
  electron: process.versions.electron
});

contextBridge.exposeInMainWorld('electronAPI', {
  getVersions: getRuntimeVersions
});

