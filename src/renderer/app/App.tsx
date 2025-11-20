import React from 'react';
import { ipcRenderer } from 'electron';
import type { DeviceInfo } from '../../shared/models/device';
import { useAppDispatch, useAppSelector } from './store/hooks';
import { selectDevicesList, selectDevicesLoading, setDevices, setDevicesLoading } from './store/devices/devices.slice';

const App = () => {
  const dispatch = useAppDispatch();
  const devices = useAppSelector(selectDevicesList);
  const devicesLoading = useAppSelector(selectDevicesLoading);

  React.useEffect(() => {
    // Kick off the initial device sync. The main process responds via `devices:update`
    // and every subsequent update gets normalized through the Redux slice.
    dispatch(setDevicesLoading(true));
    const handler = (_event: Electron.IpcRendererEvent, devicesList: DeviceInfo[]) => {
      dispatch(setDevices(devicesList));
    };
    ipcRenderer.on('devices:update', handler);
    ipcRenderer.send('devices:request');

    return () => {
      ipcRenderer.removeListener('devices:update', handler);
    };
  }, [dispatch]);

  const handleClaimUsb = (deviceId: string) => {
    ipcRenderer.send('devices:claim', deviceId);
  };

  const handleReleaseUsb = (deviceId: string) => {
    ipcRenderer.send('devices:release', deviceId);
  };

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <header>
        <h1>All-in-one Electron starter.</h1>
        <p>You're now running a typed React renderer with a secure preload bridge.</p>
      </header>

      <section>
        <h2>USB device coordination</h2>
        {devicesLoading && <p>Loading devices...</p>}
        {devices.length ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', paddingBottom: 4 }}>Device</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', paddingBottom: 4 }}>Owner</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', paddingBottom: 4 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => {
                const isOwnedBySelf = device.ownerLabel === 'This session';
                const claimDisabled = Boolean(device.ownerLabel && !isOwnedBySelf);
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

