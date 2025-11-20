import React from 'react';
import { ipcRenderer } from 'electron';
import type { DeviceInfo } from '../../shared/models/device';
import { useAppDispatch, useAppSelector } from './store/hooks';
import { selectDevicesList, selectDevicesLoading, setDevices, setDevicesLoading } from './store/devices/devices.slice';
import './App.css';

const App = () => {
  const dispatch = useAppDispatch();
  const devices = useAppSelector(selectDevicesList);
  const devicesLoading = useAppSelector(selectDevicesLoading);

  React.useEffect(() => {
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

  const totalDevices = devices.length;
  const availableDevices = devices.filter((device) => !device.ownerLabel).length;
  const ownedBySession = devices.filter((device) => device.ownerLabel === 'This session').length;
  const reservedDevices = totalDevices - availableDevices;
  const pillClass = `pill ${devicesLoading ? 'pill--syncing' : 'pill--live'}`;

  const getStatusClass = (device: DeviceInfo) => {
    if (!device.ownerLabel) return 'status-chip status--available';
    if (device.ownerLabel === 'This session') return 'status-chip status--self';
    return 'status-chip status--busy';
  };

  const getOwnerLabel = (device: DeviceInfo) => {
    if (!device.ownerLabel) return 'Available';
    if (device.ownerLabel === 'This session') return 'Reserved by you';
    return device.ownerLabel;
  };

  return (
    <div className="app-shell">
      <header className="app-hero">
        <div className="hero-copy">
          <span className="eyebrow">Device orchestration</span>
          <h1>USB Device Control Center</h1>
          <p className="hero-subtitle">Monitor and moderate how each desktop instance interacts with shared USB hardware. Claim devices when you need them and release with a click.</p>
        </div>

        <div className="stats-grid">
          <article className="stats-card">
            <p className="stats-label">Total devices</p>
            <p className="stats-value">{totalDevices}</p>
          </article>
          <article className="stats-card">
            <p className="stats-label">Available</p>
            <p className="stats-value">{availableDevices}</p>
          </article>
          <article className="stats-card">
            <p className="stats-label">Reserved</p>
            <p className="stats-value">{reservedDevices}</p>
          </article>
          <article className="stats-card">
            <p className="stats-label">Owned by this session</p>
            <p className="stats-value">{ownedBySession}</p>
          </article>
        </div>
      </header>

      <section className="card">
        <div className="section-header">
          <div>
            <span className="eyebrow">Live overview</span>
            <h2>USB device coordination</h2>
          </div>
          <span className={pillClass}>{devicesLoading ? 'Syncing…' : 'Live updates'}</span>
        </div>

        {devices.length ? (
          <table className="device-table">
            <thead>
              <tr>
                <th>Device</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => {
                const isOwnedBySelf = device.ownerLabel === 'This session';
                const claimDisabled = Boolean(device.ownerLabel && !isOwnedBySelf);
                const releaseDisabled = !isOwnedBySelf;

                return (
                  <tr key={device.id}>
                    <td>{device.id}</td>
                    <td>
                      <span className={getStatusClass(device)}>{getOwnerLabel(device)}</span>
                    </td>
                    <td>
                      <button className="btn btn--primary" disabled={claimDisabled} onClick={() => handleClaimUsb(device.id)}>
                        Claim
                      </button>
                      <button className="btn btn--ghost" disabled={releaseDisabled} onClick={() => handleReleaseUsb(device.id)}>
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

      <section className="card info-card">
        <span className="eyebrow">Next steps</span>
        <h2>Where to go from here?</h2>
        <ul>
          <li>Wire real USB discovery logic inside <code>main.ts</code> and broadcast updates when hardware changes.</li>
          <li>Expand Redux with additional slices if you need per-device metadata or history.</li>
          <li>Use the Playwright + Jest setups under <code>tests/</code> to validate new flows.</li>
        </ul>
      </section>
    </div>
  );
};

export default App;

