# Redux Architecture Overview

Redux powers the USB device table rendered in the UI. Device data originates from the Electron main process (via IPC) and flows through Redux so every component shares the same state. This document captures the structure so new contributors know where to plug in.

## Directory Layout

```
src/
└─ renderer/
   └─ app/
      ├─ store/
      │  ├─ index.ts      // configureStore + root reducer
      │  ├─ hooks.ts      // typed useAppDispatch/useAppSelector
      │  └─ devices/
      │     └─ devices.slice.ts
      └─ App.tsx
```

- The `devices` slice owns the entire Redux state.
- If additional slices are added in the future, follow the same folder pattern.

## State Tree

```
RootState
└─ devices
   ├─ ids: string[]
   ├─ entities: Record<string, DeviceInfo>
   └─ loading: boolean
```

- `ids` preserves ordering for table rendering.
- `entities` stores the latest snapshot provided by Electron’s main process.
- `loading` flips true while the first `devices:request` round-trip is pending.

## Actions & Reducers (`devices.slice.ts`)

- `setDevices(devices: DeviceInfo[])` – replaces the normalized slice with the most recent IPC snapshot.
- `setDevicesLoading(boolean)` – toggles the loading flag while waiting for the first response.

## Selectors

- `selectDevicesState` – returns the raw slice.
- `selectDevicesList` – memoized selector that maps `ids` → presentation objects (`{ id, ownerLabel, statusMessage }`).

Because `selectDevicesList` uses `createSelector`, React components won’t rerender unless the underlying slice actually changes.

## Store Configuration

`src/renderer/app/store/index.ts`
```ts
import { configureStore } from '@reduxjs/toolkit';
import devicesReducer from './devices/devices.slice';

export const store = configureStore({
  reducer: {
    devices: devicesReducer
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

`hooks.ts` exports typed `useAppDispatch` / `useAppSelector` helpers that the renderer imports.

## Data Flow

1. Renderer mounts → `ipcRenderer.send('devices:request')` → main replies via `devices:update`. Listener dispatches `setDevices`.
2. User clicks **Claim** / **Release** → renderer sends `devices:claim` / `devices:release`. Main mutates its in-memory map and broadcasts `devices:update`.
3. Redux replaces the slice with the broadcast payload, and React components rerender automatically.

Because IPC usage is centralized in the renderer (no preload bridge), swapping in real hardware logic later only requires changes to `main.ts`.
