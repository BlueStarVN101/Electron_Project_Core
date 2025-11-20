/**
 * Replace the sample identifiers with the actual USB device IDs your app needs to coordinate.
 * This sits under the preload api folder so both the preload bridge and the main process
 * can import a single source of truth without hardcoding the list elsewhere.
 */
const trackedUsbDevices = ['Sensor-A', 'Sensor-B', 'Sensor-C'];

export const getTrackedUsbDevices = (): string[] => [...trackedUsbDevices];


