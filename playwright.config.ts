import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end suite (spec 11.3). The app runs in `--mode e2e`: Firebase is switched off
 * (its env vars are blanked below, overriding any .env.local), so nothing touches a real
 * project, and Gemini is replaced by a scripted model that drives the real tool loop.
 */
const PORT = 5174
const BLANK_FIREBASE = Object.fromEntries(
  ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID', 'VITE_APPCHECK_RECAPTCHA_ENTERPRISE_SITE_KEY'].map((k) => [k, '']),
)

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'off',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: `vite --mode e2e --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    env: BLANK_FIREBASE,
    timeout: 60_000,
  },
})
