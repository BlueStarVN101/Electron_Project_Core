export type InstanceState = {
  selfPid: number;
  leaderPid: number | null;
  estimatedCount: number;
  processCount: number;
  connectedPids: number[];
  usbOwnerPid: number | null;
  usbOwnerLabel: string | null;
  isLeader: boolean;
  lastUpdated: number;
};

export type InstanceStatePayload = {
  leaderPid: number | null;
  estimatedCount: number;
  processCount: number;
  connectedPids: number[];
  usbOwnerPid: number | null;
  lastUpdated: number;
};


