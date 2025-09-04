// @ts-check
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 180_000,
  expect: { timeout: 30_000 },
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    headless: false,
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    viewport: { width: 1400, height: 900 },
    trace: 'retain-on-failure'
  }
});

