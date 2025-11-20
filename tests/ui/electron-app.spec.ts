import { test, expect, _electron as electron } from '@playwright/test';

const appLaunchArgs = ['dist/main/index.js'];

test.describe('Electron app smoke test', () => {
  test('shows device coordination table fed by IPC', async () => {
    const electronApp = await electron.launch({ args: appLaunchArgs });
    const page = await electronApp.firstWindow();

    await expect(page.getByRole('heading', { name: /usb device coordination/i })).toBeVisible();
    await expect(page.locator('table tbody tr')).toHaveCount(3);
    await expect(page.getByText('Sensor-A')).toBeVisible();

    await electronApp.close();
  });
});

