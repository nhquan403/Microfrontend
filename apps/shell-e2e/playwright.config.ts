import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const workspaceRoot = resolve(__dirname, '../..');
const envFile = resolve(workspaceRoot, '.env');
// Test users' passwords and service settings come from the root .env (see .env.example).
if (existsSync(envFile)) process.loadEnvFile(envFile);

const BASE_URL = 'http://localhost:4000';
const OUT = 'dist/apps';

/**
 * Runs against production builds served by the BFF (`SERVE_MODE=static`), with Keycloak from
 * `npm run infra:up` already running. `nx e2e shell-e2e` builds every app first.
 */
export default defineConfig({
  testDir: './src',
  outputDir: './test-results',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  timeout: 60_000,
  reporter: process.env['CI']
    ? [['list'], ['html', { open: 'never' }]]
    : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Lets environments with a preinstalled Chromium skip `playwright install`.
        launchOptions: process.env['PW_CHROMIUM_PATH']
          ? { executablePath: process.env['PW_CHROMIUM_PATH'] }
          : {},
      },
    },
  ],
  webServer: [
    {
      command: `node --env-file=.env ${OUT}/demo-api/main.js`,
      cwd: workspaceRoot,
      port: 4100,
      reuseExistingServer: !process.env['CI'],
      timeout: 30_000,
    },
    {
      command: `node --env-file=.env ${OUT}/bff/main.js`,
      cwd: workspaceRoot,
      url: `${BASE_URL}/auth/me`,
      reuseExistingServer: !process.env['CI'],
      timeout: 60_000,
      env: { SERVE_MODE: 'static' },
    },
  ],
});
