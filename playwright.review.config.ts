import { defineConfig, devices } from '@playwright/test';

/**
 * The config for the REVIEW harnesses, which are review aids rather than checks.
 *
 * WHY THIS FILE EXISTS. `playwright.config.ts` carries
 * `testIgnore: /tests\/review\/.*​/` so the harnesses never run in CI -- they
 * pause waiting for a human, or write screenshots nobody asserts on. But
 * `testIgnore` applies even when a file is named explicitly on the command
 * line, so `npm run review:agent` was matching zero tests and silently doing
 * nothing. That was a latent bug from feature 002, found while wiring up 003's
 * screenshot harness.
 *
 * So the review harnesses get their own config, with no testIgnore and nothing
 * else changed. CI still runs `playwright.config.ts` and still sees none of them.
 */
export default defineConfig({
  testDir: './tests/review',
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx serve out -l 4321',
    url: 'http://localhost:4321',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
