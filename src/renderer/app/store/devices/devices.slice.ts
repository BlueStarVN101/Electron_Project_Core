import { createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { DeviceInfo } from '../../../../shared/models/device';
import type { RootState } from '../index';

type DeviceId = string;

type DevicesState = {
  ids: DeviceId[];
  entities: Record<DeviceId, DeviceInfo>;
  loading: boolean;
};

const buildInitialState = (devices: DeviceInfo[]): DevicesState => ({
  ids: devices.map((device) => device.id),
  entities: devices.reduce<Record<DeviceId, DeviceInfo>>((acc, device) => {
    acc[device.id] = device;
    return acc;
  }, {}),
  loading: false
});

const initialState: DevicesState = {
  ids: [],
  entities: {},
  loading: false
};

const applySnapshot = (state: DevicesState, devices: DeviceInfo[]): void => {
  const next = buildInitialState(devices);
  state.ids = next.ids;
  state.entities = next.entities;
};

const devicesSlice = createSlice({
  name: 'devices',
  initialState,
  reducers: {
    setDevices(state, action: PayloadAction<DeviceInfo[]>) {
      applySnapshot(state, action.payload);
      state.loading = false;
    },
    setDevicesLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    }
  }
});

export const { setDevices, setDevicesLoading } = devicesSlice.actions;

export default devicesSlice.reducer;

export const selectDevicesState = (state: RootState) => state.devices;

export const selectDevicesList = createSelector([selectDevicesState], (devicesState) =>
  devicesState.ids
    .map((id) => devicesState.entities[id])
    .filter((device): device is DeviceInfo => Boolean(device))
);

export const selectDevicesLoading = (state: RootState) => state.devices.loading;


