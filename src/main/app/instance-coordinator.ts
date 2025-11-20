import { EventEmitter } from 'node:events';
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import psList from 'ps-list';
import type { InstanceState, InstanceStatePayload } from '../../shared/models/instance';

type WireMessage =
  | { type: 'hello'; pid: number }
  | { type: 'usb-claim'; pid: number; deviceId: string }
  | { type: 'usb-release'; pid: number; deviceId: string }
  | { type: 'usb-sync'; pid: number; deviceIds: string[] }
  | { type: 'state'; payload: InstanceStatePayload };

const sanitizeIdentifier = (value: string): string => value.replace(/[^a-z0-9_-]/gi, '-').toLowerCase();

/**
 * Create a cross-platform pipe/socket endpoint that every instance can derive from the
 * Electron app name. This lets the first instance host a server while subsequent instances
 * connect as clients without any additional config.
 */
const buildPipePath = (rawIdentifier: string): string => {
  const identifier = sanitizeIdentifier(rawIdentifier || 'electron-instance-bus');
  if (process.platform === 'win32') {
    return `\\\\.\\pipe\\${identifier}`;
  }

  return path.join(os.tmpdir(), `${identifier}.sock`);
};

const newline = '\n';
const sanitizeDeviceId = (value: string): string => value.trim();

/**
 * InstanceCoordinator wires up a small IPC fabric across app.exe processes.
 * One process becomes the "leader" (server) and keeps authoritative state for:
 *   - Estimated connected peers (client sockets)
 *   - Observed executable count (via ps-list so zombie nodes still count)
 *   - USB ownership arbitration
 *
 * Clients connect over the named pipe, receive push updates, and can emit intents
 * (hello / usb-claim / usb-release). The leader re-broadcasts state to keep everyone
 * in sync and also exposes snapshot APIs for the renderer.
 */
export class InstanceCoordinator extends EventEmitter {
  private readonly pipePath: string;
  private readonly processName: string;
  private server?: net.Server;
  private client?: net.Socket;
  private readonly clients = new Map<net.Socket, number>();
  private readonly buffer = new Map<net.Socket, string>();
  private readonly usbDevices = new Map<string, number | null>();
  private disposed = false;

  private state: InstanceState = {
    selfPid: process.pid,
    leaderPid: null,
    estimatedCount: 1,
    processCount: 1,
    connectedPids: [],
    usbDevices: [],
    isLeader: false,
    lastUpdated: Date.now()
  };

  constructor(identifier: string, initialUsbDevices: string[] = []) {
    super();
    this.pipePath = buildPipePath(identifier);
    this.processName = path.basename(process.execPath).toLowerCase();
    this.applyUsbDeviceSync(initialUsbDevices);
  }

  /**
   * Attempt to become the leader. If the pipe is already taken, fall back to joining as a client.
   */
  public async init(): Promise<void> {
    try {
      await this.startServer();
    } catch (serverErr) {
      await this.startClient(serverErr as NodeJS.ErrnoException);
    }
  }

  /**
   * Update the list of USB device identifiers we should coordinate across instances.
   * Clients forward the request to the current leader; leaders update their own map
   * and broadcast the new snapshot.
   */
  public async setUsbDevices(deviceIds: string[]): Promise<void> {
    const normalizedIds = this.normalizeDeviceIds(deviceIds);

    if (this.state.isLeader) {
      this.applyUsbDeviceSync(normalizedIds);
      await this.updateState('usb-sync-local');
      return;
    }

    this.sendToServer({ type: 'usb-sync', pid: process.pid, deviceIds: normalizedIds });
  }

  public async getSnapshot(): Promise<InstanceState> {
    await this.refreshProcessCount('snapshot');
    return { ...this.state };
  }

  /**
   * Reserve the specified USB device for the current process. If we're the leader we can
   * immediately update state; otherwise we ask the leader and wait for its response.
   */
  public async claimUsbDevice(targetDeviceId: string): Promise<boolean> {
    const deviceId = sanitizeDeviceId(targetDeviceId);
    if (!deviceId) {
      return false;
    }

    if (this.state.isLeader) {
      this.ensureUsbDevice(deviceId);
      const currentOwner = this.usbDevices.get(deviceId);
      if (currentOwner && currentOwner !== process.pid) {
        return currentOwner === process.pid;
      }
      this.usbDevices.set(deviceId, process.pid);
      this.state.usbDevices = this.getUsbDevicesSnapshot();
      await this.updateState('leader-usb-claim');
      return true;
    }

    this.sendToServer({ type: 'usb-claim', pid: process.pid, deviceId });
    return this.waitForCondition(() => this.getDeviceOwnerFromState(deviceId) === process.pid);
  }

  /**
   * Release the shared USB resource so another instance can acquire it.
   */
  public async releaseUsbDevice(targetDeviceId: string): Promise<boolean> {
    const deviceId = sanitizeDeviceId(targetDeviceId);
    if (!deviceId) {
      return false;
    }

    if (this.state.isLeader) {
      this.ensureUsbDevice(deviceId);
      const currentOwner = this.usbDevices.get(deviceId);
      if (currentOwner !== process.pid) {
        return true;
      }
      this.usbDevices.set(deviceId, null);
      this.state.usbDevices = this.getUsbDevicesSnapshot();
      await this.updateState('leader-usb-release');
      return true;
    }

    this.sendToServer({ type: 'usb-release', pid: process.pid, deviceId });
    return this.waitForCondition(() => this.getDeviceOwnerFromState(deviceId) !== process.pid);
  }

  /**
   * Tear down sockets/servers and clean up the pipe when the app quits.
   */
  public dispose(): void {
    this.disposed = true;
    this.client?.destroy();
    for (const socket of this.clients.keys()) {
      socket.destroy();
    }
    this.server?.close();
    if (process.platform !== 'win32' && fs.existsSync(this.pipePath)) {
      try {
        fs.unlinkSync(this.pipePath);
      } catch {
        // noop
      }
    }
  }

  /**
   * Bind the named pipe (or Unix socket) and start listening for peers.
   */
  private async startServer(): Promise<void> {
    if (process.platform !== 'win32' && fs.existsSync(this.pipePath)) {
      fs.unlinkSync(this.pipePath);
    }

    await new Promise<void>((resolve, reject) => {
      const server = net.createServer((socket) => this.handleServerConnection(socket));
      server.on('error', (error) => {
        server.close();
        reject(error);
      });
      server.listen(this.pipePath, () => {
        this.server = server;
        this.state.isLeader = true;
        this.state.leaderPid = process.pid;
        if (this.state.usbDevices.length > 0 && this.usbDevices.size === 0) {
          this.applyUsbDeviceSync(this.state.usbDevices.map((device) => device.id));
        }
        void this.updateState('server-started');
        resolve();
      });
    });
  }

  /**
   * Connect to the existing leader. If the leader disappears between runs we retry by
   * promoting ourselves to leader.
   */
  private async startClient(originError?: NodeJS.ErrnoException): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const socket = net.createConnection(this.pipePath);
      let connected = false;

      socket.once('connect', () => {
        connected = true;
        this.client = socket;
        this.prepareSocket(socket, (message) => this.handleServerMessage(message));
        socket.on('close', () => this.handleClientDisconnect(socket));
        socket.on('error', (error) => {
          console.error('InstanceCoordinator client socket error', error);
        });
        this.sendToServer({ type: 'hello', pid: process.pid });
        resolve();
      });

      socket.once('error', async (error: NodeJS.ErrnoException) => {
        socket.destroy();

        if (connected) {
          this.scheduleRejoin();
          return;
        }

        if (['ECONNREFUSED', 'ENOENT'].includes(error.code ?? '')) {
          try {
            await this.startServer();
            resolve();
          } catch (startErr) {
            reject(startErr);
          }
          return;
        }

        reject(originError ?? error);
      });
    });
  }

  private handleServerConnection(socket: net.Socket): void {
    this.prepareSocket(socket, (message) => this.handleClientMessage(socket, message));
    socket.on('close', () => {
      const pid = this.clients.get(socket);
      this.clients.delete(socket);
      this.buffer.delete(socket);
      if (pid) {
        void this.updateState('client-disconnected');
      }
    });
  }

  /**
   * Process intents received from connected peers.
   */
  private async handleClientMessage(socket: net.Socket, message: WireMessage): Promise<void> {
    switch (message.type) {
      case 'hello':
        this.clients.set(socket, message.pid);
        await this.updateState('client-hello');
        this.sendState(socket);
        break;
      case 'usb-claim':
        {
          const deviceId = sanitizeDeviceId(message.deviceId);
          if (!deviceId) {
            break;
          }
          this.ensureUsbDevice(deviceId);
        {
            const currentOwner = this.usbDevices.get(deviceId);
            if (!currentOwner || currentOwner === message.pid) {
              this.usbDevices.set(deviceId, message.pid);
              this.state.usbDevices = this.getUsbDevicesSnapshot();
              await this.updateState('usb-claimed');
            } else {
              this.sendState(socket);
            }
          }
        }
        break;
      case 'usb-release':
        {
          const deviceId = sanitizeDeviceId(message.deviceId);
          if (!deviceId) {
            break;
          }
          this.ensureUsbDevice(deviceId);
          if (this.usbDevices.get(deviceId) === message.pid) {
            this.usbDevices.set(deviceId, null);
            this.state.usbDevices = this.getUsbDevicesSnapshot();
            await this.updateState('usb-released');
          }
        }
        break;
      case 'usb-sync':
        this.applyUsbDeviceSync(message.deviceIds);
        await this.updateState('usb-sync-remote');
        break;
      default:
        break;
    }
  }

  /**
   * Handle push updates from the leader when we're in client mode.
   */
  private handleServerMessage(message: WireMessage): void {
    if (message.type !== 'state') {
      return;
    }

    this.applySharedState(message.payload);
  }

  private sendToServer(message: WireMessage): void {
    if (!this.client) {
      return;
    }

    this.client.write(`${JSON.stringify(message)}${newline}`);
  }

  /**
   * Broadcast the latest authoritative state to all connected peers (or a single target).
   */
  private sendState(target?: net.Socket): void {
    const payload: InstanceStatePayload = {
      leaderPid: this.state.leaderPid,
      estimatedCount: this.state.estimatedCount,
      processCount: this.state.processCount,
      connectedPids: this.state.connectedPids,
      usbDevices: this.state.usbDevices,
      lastUpdated: this.state.lastUpdated
    };

    const serialized = `${JSON.stringify({ type: 'state', payload })}${newline}`;

    if (target) {
      target.write(serialized);
      return;
    }

    for (const client of this.clients.keys()) {
      client.write(serialized);
    }
  }

  /**
   * Buffer newline-delimited JSON payloads so we can parse them safely regardless of chunking.
   */
  private prepareSocket(socket: net.Socket, onMessage: (message: WireMessage) => void): void {
    this.buffer.set(socket, '');
    socket.setEncoding('utf-8');
    socket.on('data', (chunk: string) => {
      const existing = this.buffer.get(socket) ?? '';
      let combined = existing + chunk;
      let boundary: number;
      while ((boundary = combined.indexOf(newline)) >= 0) {
        const packet = combined.slice(0, boundary).trim();
        combined = combined.slice(boundary + 1);
        if (!packet) {
          continue;
        }
        try {
          onMessage(JSON.parse(packet));
        } catch (parseError) {
          console.error('InstanceCoordinator failed to parse message', parseError);
        }
      }
      this.buffer.set(socket, combined);
    });
  }

  /**
   * Recalculate leader-owned state and notify listeners + peers.
   */
  private async updateState(reason: string): Promise<void> {
    if (!this.state.isLeader) {
      return;
    }

    this.state.estimatedCount = 1 + this.clients.size;
    const leaderPid = process.pid;
    this.state.leaderPid = leaderPid;
    this.state.connectedPids = [leaderPid, ...this.clients.values()];
    this.state.usbDevices = this.getUsbDevicesSnapshot();
    await this.refreshProcessCount(reason);
    this.emitState();
    this.sendState();
  }

  /**
   * Use ps-list to count how many OS processes match the executable name.
   * This supplements the live connections list so we can report zombie/background instances
   * that haven't joined the pipe yet.
   */
  private async refreshProcessCount(reason: string): Promise<void> {
    try {
      const processes = await psList();
      const executableCount = processes.filter((proc) => proc.name?.toLowerCase() === this.processName).length;
      if (executableCount > 0) {
        this.state.processCount = executableCount;
      } else {
        this.state.processCount = this.state.estimatedCount;
      }
    } catch (error) {
      console.error(`InstanceCoordinator failed to refresh process count (${reason})`, error);
      this.state.processCount = this.state.estimatedCount;
    } finally {
      this.state.lastUpdated = Date.now();
    }
  }

  /**
   * Update our local snapshot when the leader broadcasts a new state payload.
   */
  private applySharedState(payload: InstanceStatePayload): void {
    this.state = {
      ...this.state,
      leaderPid: payload.leaderPid,
      estimatedCount: payload.estimatedCount,
      processCount: payload.processCount,
      connectedPids: payload.connectedPids,
      usbDevices: payload.usbDevices,
      lastUpdated: payload.lastUpdated,
      isLeader: false
    };
    this.emitState();
  }

  private getUsbDevicesSnapshot(): InstanceState['usbDevices'] {
    return Array.from(this.usbDevices.entries()).map(([id, ownerPid]) => ({
      id,
      ownerPid,
      ownerLabel: this.resolveUsbOwnerLabel(ownerPid)
    }));
  }

  private normalizeDeviceIds(deviceIds: string[]): string[] {
    const seen = new Set<string>();
    const normalized: string[] = [];
    for (const candidate of deviceIds) {
      const id = sanitizeDeviceId(candidate);
      if (!id || seen.has(id)) {
        continue;
      }
      seen.add(id);
      normalized.push(id);
    }
    return normalized;
  }

  private applyUsbDeviceSync(deviceIds: string[]): void {
    const normalized = this.normalizeDeviceIds(deviceIds);
    const previousOwners = new Map(this.usbDevices);
    this.usbDevices.clear();
    for (const id of normalized) {
      this.usbDevices.set(id, previousOwners.get(id) ?? null);
    }
    this.state.usbDevices = this.getUsbDevicesSnapshot();
  }

  private ensureUsbDevice(deviceId: string): void {
    const sanitized = sanitizeDeviceId(deviceId);
    if (!sanitized || this.usbDevices.has(sanitized)) {
      return;
    }
    this.usbDevices.set(sanitized, null);
    this.state.usbDevices = this.getUsbDevicesSnapshot();
  }

  private getDeviceOwnerFromState(deviceId: string): number | null {
    const sanitized = sanitizeDeviceId(deviceId);
    if (!sanitized) {
      return null;
    }
    return this.state.usbDevices.find((device) => device.id === sanitized)?.ownerPid ?? null;
  }

  private emitState(): void {
    if (this.disposed) {
      return;
    }
    this.emit('state-changed', { ...this.state });
  }

  private resolveUsbOwnerLabel(ownerPid: number | null): string | null {
    if (!ownerPid) {
      return null;
    }

    if (ownerPid === process.pid) {
      return 'This instance';
    }

    return `PID ${ownerPid}`;
  }

  /**
   * Helper to convert leader responses into awaitable promises for clients.
   * We subscribe to the state stream, wait until the predicate is satisfied, then resolve.
   */
  private waitForCondition(predicate: () => boolean, timeoutMs = 2000): Promise<boolean> {
    if (predicate()) {
      return Promise.resolve(true);
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.off('state-changed', listener);
        resolve(predicate());
      }, timeoutMs);

      const listener = () => {
        if (predicate()) {
          clearTimeout(timeout);
          this.off('state-changed', listener);
          resolve(true);
        }
      };

      this.on('state-changed', listener);
    });
  }

  private handleClientDisconnect(socket: net.Socket): void {
    this.buffer.delete(socket);
    this.client = undefined;
    this.scheduleRejoin();
  }

  /**
   * If the leader unexpectedly goes away we wait a beat and re-run init() so that either
   * we become the new leader or reconnect to whoever replaced it.
   */
  private scheduleRejoin(): void {
    if (this.disposed) {
      return;
    }

    setTimeout(() => {
      if (this.disposed) {
        return;
      }
      this.init().catch((error) => {
        console.error('InstanceCoordinator failed to rejoin bus', error);
      });
    }, 250);
  }
}

export default InstanceCoordinator;


