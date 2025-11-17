export {};

type VersionMap = {
  node: string;
  chrome: string;
  electron: string;
};

declare global {
  interface ElectronAPI {
    getVersions: () => VersionMap;
  }

  interface Window {
    electronAPI?: ElectronAPI;
  }
}

