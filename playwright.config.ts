import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  workers: process.env.CI ? 2 : undefined,
  use: { baseURL: process.env.LIVE_URL || 'http://127.0.0.1:4173/passport-photo-maker/', acceptDownloads: true },
  webServer: process.env.LIVE_URL ? undefined : {
    command: 'npm run dev -- --port 4173',
    url: 'http://127.0.0.1:4173/passport-photo-maker/',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
});
