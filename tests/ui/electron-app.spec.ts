import { test, expect, _electron as electron } from '@playwright/test';

const appLaunchArgs = ['dist/main/index.js'];

test.describe('Electron app smoke test', () => {
  test('displays runtime versions in the renderer', async () => {
    const electronApp = await electron.launch({ args: appLaunchArgs });
    const page = await electronApp.firstWindow();

    await expect(page.getByRole('heading', { name: /runtime versions/i })).toBeVisible();
    await expect(page.getByText(/Electron:/)).toBeVisible();

    await electronApp.close();
  });
});

