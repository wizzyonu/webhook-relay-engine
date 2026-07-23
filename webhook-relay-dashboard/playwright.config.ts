import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for the Webhook Relay Dashboard.
 * - Frontend (Vite CSR): http://localhost:5173
 * - Backend API (Go):    http://localhost:3000
 *
 * Run the full stack first via: docker-compose up -d
 * Then execute: npx playwright test
 */
export default defineConfig({
  testDir: './e2e/specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,   // Fail if .only is committed in CI
  retries: process.env.CI ? 2 : 0, // Retry flaky tests in CI only
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html'], ['list']],

  use: {
    baseURL: process.env.FRONTEND_URL || 'http://localhost:5173',
    trace: 'on-first-retry',       // Capture trace on failure for debugging
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  // Optional: auto-start the frontend dev server if not running.
  // Uncomment if you are NOT using docker-compose for the frontend.
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:5173',
  //   reuseExistingServer: !process.env.CI,
  // },
});