export type UsbDeviceState = {
  id: string;
  ownerPid: number | null;
  ownerLabel: string | null;
};

export type InstanceState = {
  selfPid: number;
  leaderPid: number | null;
  estimatedCount: number;
  processCount: number;
  connectedPids: number[];
  usbDevices: UsbDeviceState[];
  isLeader: boolean;
  lastUpdated: number;
};

export type InstanceStatePayload = {
  leaderPid: number | null;
  estimatedCount: number;
  processCount: number;
  connectedPids: number[];
  usbDevices: UsbDeviceState[];
  lastUpdated: number;
};


