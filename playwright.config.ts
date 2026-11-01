import { defineConfig, devices } from '@playwright/test';

const CI = !!process.env.CI;

/**
 * End-to-end tests against a production build (vite preview).
 * Locally they use the installed Chrome; CI installs Playwright's Chromium.
 * Each test gets a fresh browser context, so a fresh local database.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1280, height: 900 },
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 }, channel: CI ? undefined : 'chrome' } },
  ],
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !CI,
    timeout: 240_000,
  },
});
