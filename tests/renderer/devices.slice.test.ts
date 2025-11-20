import reducer, { setDevices, setDevicesLoading } from '../../src/renderer/app/store/devices/devices.slice';
import type { DeviceInfo } from '../../src/shared/models/device';

describe('devices slice', () => {
  const mockDevices: DeviceInfo[] = [
    { id: 'USB-A', ownerLabel: null },
    { id: 'USB-B', ownerLabel: 'This session' }
  ];

  it('should handle setDevices', () => {
    const state = reducer(undefined, setDevices(mockDevices));
    expect(state.ids).toEqual(['USB-A', 'USB-B']);
    expect(state.entities['USB-A']).toEqual({ id: 'USB-A', ownerLabel: null });
    expect(state.loading).toBe(false);
  });

  it('should toggle loading flag', () => {
    const state = reducer(undefined, setDevicesLoading(true));
    expect(state.loading).toBe(true);
  });
});


