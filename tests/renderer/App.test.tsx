import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import App from '../../src/renderer/app/App';
import { store } from '../../src/renderer/app/store';
import type { DeviceInfo } from '../../src/shared/models/device';

const mockDevices: DeviceInfo[] = [
  { id: 'Device-1', ownerLabel: null },
  { id: 'Device-2', ownerLabel: 'This session' }
];

const listeners: Record<string, (event: Electron.IpcRendererEvent, payload: DeviceInfo[]) => void> = {};

jest.mock('electron', () => ({
  ipcRenderer: {
    on: jest.fn((channel: string, handler: (event: Electron.IpcRendererEvent, payload: DeviceInfo[]) => void) => {
      listeners[channel] = handler;
    }),
    send: jest.fn((channel: string) => {
      if (channel === 'devices:request') {
        listeners['devices:update']?.({} as Electron.IpcRendererEvent, mockDevices);
      }
    }),
    removeListener: jest.fn((channel: string) => {
      delete listeners[channel];
    })
  }
}));

const renderApp = () =>
  render(
    <Provider store={store}>
      <App />
    </Provider>
  );

describe('App component', () => {
  it('renders device table populated via IPC snapshot', async () => {
    renderApp();

    expect(await screen.findByText('Device-1')).toBeInTheDocument();
    expect(screen.getByText('Device-2')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /usb device coordination/i })).toBeInTheDocument();
  });
});

