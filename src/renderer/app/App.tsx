import React from 'react';
import type { InstanceState } from '../../shared/models/instance';
import type { RuntimeVersions } from '../../shared/models/runtime';

const App = () => {
  const [versions, setVersions] = React.useState<RuntimeVersions | null>(null);
  const [instanceState, setInstanceState] = React.useState<InstanceState | null>(null);
  const [usbMessages, setUsbMessages] = React.useState<Record<string, string>>({});

  // Fetch static runtime versions once on mount.
  React.useEffect(() => {
    const versionInfo = window.electronAPI?.getVersions();
    if (versionInfo) {
      setVersions(versionInfo);
    }
  }, []);

  // Listen for instance coordinator updates and populate the dashboard.
  React.useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const bootstrapInstanceState = async () => {
      const state = await window.electronAPI?.getInstanceState();
      if (state) {
        setInstanceState(state);
      }
      unsubscribe = window.electronAPI?.onInstanceState((nextState) => {
        setInstanceState(nextState);
      });
    };

    void bootstrapInstanceState();

    return () => {
      unsubscribe?.();
    };
  }, []);

  const updateUsbMessage = React.useCallback((deviceId: string, message: string) => {
    setUsbMessages((prev) => ({
      ...prev,
      [deviceId]: message
    }));
  }, []);

  const handleClaimUsb = async (deviceId: string) => {
    const result = (await window.electronAPI?.claimUsbDevice(deviceId)) ?? false;
    updateUsbMessage(deviceId, result ? 'Reserved for this instance.' : 'Already owned by another instance.');
  };

  const handleReleaseUsb = async (deviceId: string) => {
    const result = (await window.electronAPI?.releaseUsbDevice(deviceId)) ?? false;
    updateUsbMessage(deviceId, result ? 'Released and now available.' : 'Nothing to release.');
  };

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <header>
        <h1>All-in-one Electron starter.</h1>
        <p>You're now running a typed React renderer with a secure preload bridge.</p>
      </header>

      <section>
        <h2>Runtime versions</h2>
        <ul>
          <li>Electron: {versions?.electron ?? 'loading...'}</li>
          <li>Chrome: {versions?.chrome ?? 'loading...'}</li>
          <li>Node.js: {versions?.node ?? 'loading...'}</li>
        </ul>
      </section>

      <section>
        <h2>Instance awareness</h2>
        <ul>
          <li>PID: {instanceState?.selfPid ?? 'detecting...'}</li>
          <li>Leader PID: {instanceState?.leaderPid ?? 'pending'}</li>
          <li>Estimated connected instances: {instanceState?.estimatedCount ?? 'detecting...'}</li>
          <li>Detected executables: {instanceState?.processCount ?? 'detecting...'}</li>
        </ul>
      </section>

      <section>
        <h2>USB device coordination</h2>
        {instanceState?.usbDevices?.length ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', paddingBottom: 4 }}>Device</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', paddingBottom: 4 }}>Owner</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', paddingBottom: 4 }}>Actions</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', paddingBottom: 4 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {instanceState.usbDevices.map((device) => {
                const isOwnedBySelf = device.ownerPid === instanceState.selfPid;
                const claimDisabled = Boolean(device.ownerPid && !isOwnedBySelf);
                const releaseDisabled = !isOwnedBySelf;

                return (
                  <tr key={device.id}>
                    <td style={{ padding: '8px 0' }}>{device.id}</td>
                    <td style={{ padding: '8px 0' }}>{device.ownerLabel ?? 'Available'}</td>
                    <td style={{ padding: '8px 0' }}>
                      <button style={{ marginRight: 8 }} disabled={claimDisabled} onClick={() => handleClaimUsb(device.id)}>
                        Claim
                      </button>
                      <button disabled={releaseDisabled} onClick={() => handleReleaseUsb(device.id)}>
                        Release
                      </button>
                    </td>
                    <td style={{ padding: '8px 0' }}>{usbMessages[device.id]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p>No USB devices are currently being tracked.</p>
        )}
      </section>

      <section>
        <h2>Next steps</h2>
        <p>
          Start editing <code>src/renderer/app/App.tsx</code> or add new components under <code>src/renderer/</code>. The renderer rebuilds automatically while{' '}
          <code>npm run dev</code> is running.
        </p>
      </section>
    </main>
  );
};

export default App;

