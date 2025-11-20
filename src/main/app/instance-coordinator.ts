import { EventEmitter } from 'node:events';
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import psList from 'ps-list';
import type { InstanceState, InstanceStatePayload } from '../../shared/models/instance';

type WireMessage =
  | { type: 'hello'; pid: number }
  | { type: 'usb-claim'; pid: number }
  | { type: 'usb-release'; pid: number }
  | { type: 'state'; payload: InstanceStatePayload };

const sanitizeIdentifier = (value: string): string => value.replace(/[^a-z0-9_-]/gi, '-').toLowerCase();

const buildPipePath = (rawIdentifier: string): string => {
  const identifier = sanitizeIdentifier(rawIdentifier || 'electron-instance-bus');
  if (process.platform === 'win32') {
    return `\\\\.\\pipe\\${identifier}`;
  }

  return path.join(os.tmpdir(), `${identifier}.sock`);
};

const newline = '\n';

export class InstanceCoordinator extends EventEmitter {
  private readonly pipePath: string;
  private readonly processName: string;
  private server?: net.Server;
  private client?: net.Socket;
  private readonly clients = new Map<net.Socket, number>();
  private readonly buffer = new Map<net.Socket, string>();
  private disposed = false;

  private state: InstanceState = {
    selfPid: process.pid,
    leaderPid: null,
    estimatedCount: 1,
    processCount: 1,
    connectedPids: [],
    usbOwnerPid: null,
    usbOwnerLabel: null,
    isLeader: false,
    lastUpdated: Date.now()
  };

  constructor(identifier: string) {
    super();
    this.pipePath = buildPipePath(identifier);
    this.processName = path.basename(process.execPath).toLowerCase();
  }

  public async init(): Promise<void> {
    try {
      await this.startServer();
    } catch (serverErr) {
      await this.startClient(serverErr as NodeJS.ErrnoException);
    }
  }

  public async getSnapshot(): Promise<InstanceState> {
    await this.refreshProcessCount('snapshot');
    return { ...this.state };
  }

  public async claimUsbDevice(): Promise<boolean> {
    if (this.state.usbOwnerPid === process.pid) {
      return true;
    }

    if (this.state.usbOwnerPid && this.state.usbOwnerPid !== process.pid) {
      return false;
    }

    if (this.state.isLeader) {
      this.state.usbOwnerPid = process.pid;
      await this.updateState('leader-usb-claim');
      return true;
    }

    this.sendToServer({ type: 'usb-claim', pid: process.pid });
    return this.waitForCondition(() => this.state.usbOwnerPid === process.pid);
  }

  public async releaseUsbDevice(): Promise<boolean> {
    if (this.state.usbOwnerPid !== process.pid) {
      return true;
    }

    if (this.state.isLeader) {
      this.state.usbOwnerPid = null;
      await this.updateState('leader-usb-release');
      return true;
    }

    this.sendToServer({ type: 'usb-release', pid: process.pid });
    return this.waitForCondition(() => this.state.usbOwnerPid !== process.pid);
  }

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
        void this.updateState('server-started');
        resolve();
      });
    });
  }

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

  private async handleClientMessage(socket: net.Socket, message: WireMessage): Promise<void> {
    switch (message.type) {
      case 'hello':
        this.clients.set(socket, message.pid);
        await this.updateState('client-hello');
        this.sendState(socket);
        break;
      case 'usb-claim':
        if (!this.state.usbOwnerPid || this.state.usbOwnerPid === message.pid) {
          this.state.usbOwnerPid = message.pid;
          await this.updateState('usb-claimed');
        } else {
          this.sendState(socket);
        }
        break;
      case 'usb-release':
        if (this.state.usbOwnerPid === message.pid) {
          this.state.usbOwnerPid = null;
          await this.updateState('usb-released');
        }
        break;
      default:
        break;
    }
  }

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

  private sendState(target?: net.Socket): void {
    const payload: InstanceStatePayload = {
      leaderPid: this.state.leaderPid,
      estimatedCount: this.state.estimatedCount,
      processCount: this.state.processCount,
      connectedPids: this.state.connectedPids,
      usbOwnerPid: this.state.usbOwnerPid,
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

  private async updateState(reason: string): Promise<void> {
    if (!this.state.isLeader) {
      return;
    }

    this.state.estimatedCount = 1 + this.clients.size;
    const leaderPid = process.pid;
    this.state.leaderPid = leaderPid;
    this.state.connectedPids = [leaderPid, ...this.clients.values()];
    this.state.usbOwnerLabel = this.resolveUsbOwnerLabel();
    await this.refreshProcessCount(reason);
    this.emitState();
    this.sendState();
  }

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
      this.state.usbOwnerLabel = this.resolveUsbOwnerLabel();
    }
  }

  private applySharedState(payload: InstanceStatePayload): void {
    this.state = {
      ...this.state,
      leaderPid: payload.leaderPid,
      estimatedCount: payload.estimatedCount,
      processCount: payload.processCount,
      connectedPids: payload.connectedPids,
      usbOwnerPid: payload.usbOwnerPid,
      usbOwnerLabel: this.resolveUsbOwnerLabel(payload.usbOwnerPid),
      lastUpdated: payload.lastUpdated,
      isLeader: false
    };
    this.emitState();
  }

  private emitState(): void {
    if (this.disposed) {
      return;
    }
    this.emit('state-changed', { ...this.state });
  }

  private resolveUsbOwnerLabel(ownerPid: number | null = this.state.usbOwnerPid): string | null {
    if (!ownerPid) {
      return null;
    }

    if (ownerPid === process.pid) {
      return 'This instance';
    }

    return `PID ${ownerPid}`;
  }

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


