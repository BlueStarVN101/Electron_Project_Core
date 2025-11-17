import type { RuntimeVersions } from '../shared/models/runtime';

export type ElectronAPI = {
  getVersions: () => RuntimeVersions;
};

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

