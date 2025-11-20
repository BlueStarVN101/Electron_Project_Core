import type { InstanceState } from '../shared/models/instance';
import type { RuntimeVersions } from '../shared/models/runtime';

export type ElectronAPI = {
  getVersions: () => RuntimeVersions;
  getInstanceState: () => Promise<InstanceState | null>;
  onInstanceState: (callback: (state: InstanceState) => void) => () => void;
  claimUsbDevice: (deviceId: string) => Promise<boolean>;
  releaseUsbDevice: (deviceId: string) => Promise<boolean>;
};

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

