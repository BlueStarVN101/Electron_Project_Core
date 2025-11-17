import type { RuntimeVersions } from '../shared/models/runtime';

export {};

declare global {
  interface ElectronAPI {
    getVersions: () => RuntimeVersions;
  }

  interface Window {
    electronAPI?: ElectronAPI;
  }
}

