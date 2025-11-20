import React from 'react';
import type { InstanceState } from '../../shared/models/instance';
import type { RuntimeVersions } from '../../shared/models/runtime';

const App = () => {
  const [versions, setVersions] = React.useState<RuntimeVersions | null>(null);
  const [instanceState, setInstanceState] = React.useState<InstanceState | null>(null);
  const [usbMessage, setUsbMessage] = React.useState<string>('');

  React.useEffect(() => {
    const versionInfo = window.electronAPI?.getVersions();
    if (versionInfo) {
      setVersions(versionInfo);
    }
  }, []);

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

  const handleClaimUsb = async () => {
    const result = await window.electronAPI?.claimUsbDevice();
    setUsbMessage(result ? 'USB device reserved for this instance.' : 'USB device already in use.');
  };

  const handleReleaseUsb = async () => {
    const result = await window.electronAPI?.releaseUsbDevice();
    setUsbMessage(result ? 'USB device released.' : 'Failed to release USB device.');
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
          <li>USB owner: {instanceState?.usbOwnerLabel ?? 'Available'}</li>
        </ul>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button onClick={handleClaimUsb}>Claim USB</button>
          <button onClick={handleReleaseUsb}>Release USB</button>
        </div>
        {usbMessage && <p style={{ marginTop: 8 }}>{usbMessage}</p>}
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

