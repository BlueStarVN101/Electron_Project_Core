import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

const electronExecutable = require('electron') as string;
const repoRoot = path.resolve(__dirname, '..');
const electronMainPath = path.resolve(repoRoot, 'dist/main/index.js');
const testDir = path.resolve(__dirname, 'ui');
const playwrightReportDir = path.resolve(repoRoot, './tests/test-results/playwright-report');

export default defineConfig({
  testDir,
  timeout: 60 * 1000,
  fullyParallel: false,
  use: {
    actionTimeout: 10 * 1000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'electron',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [electronMainPath],
          executablePath: electronExecutable,
          env: { ...process.env, NODE_ENV: 'development' }
        }
      }
    }
  ],
  reporter: [['list'], ['html', { outputFolder: playwrightReportDir }]]
});

