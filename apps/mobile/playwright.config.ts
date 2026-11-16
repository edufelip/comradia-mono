import { defineConfig, type Project } from '@playwright/test';

const PORT = 8199;
const BASE_URL = `http://localhost:${PORT}`;
const isCI = Boolean(process.env.CI);

/** iPhone 14-ish logical viewport; the app is mobile-first and web is the secondary target. */
const PHONE_VIEWPORT = { width: 390, height: 844 };
/** iPhone SE (1st gen) / small Android: the tightest layout the design must survive. */
const SMALL_PHONE_VIEWPORT = { width: 320, height: 568 };

const phoneProject = (name: string, use: Project['use']): Project => ({ name, use });

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  globalSetup: './tests/e2e/support/global-setup.ts',
  // Firebase emulators first (auth + Firestore under the demo project), then Metro, which
  // compiles the web bundle on the first request, so give it room.
  webServer: [
    {
      command: 'yarn --cwd ../firebase emulators',
      url: 'http://127.0.0.1:9099',
      reuseExistingServer: !isCI,
      timeout: 120_000,
      stdout: 'ignore',
    },
    {
      command: `npx expo start --web --port ${PORT}`,
      url: BASE_URL,
      reuseExistingServer: !isCI,
      timeout: 180_000,
      env: {
        CI: '1',
        BROWSER: 'none',
        EXPO_NO_TELEMETRY: '1',
        EXPO_PUBLIC_FIREBASE_EMULATOR_HOST: '127.0.0.1',
      },
      stdout: 'ignore',
    },
  ],
  reporter: isCI
    ? [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : [['list']],
  use: {
    baseURL: BASE_URL,
    viewport: PHONE_VIEWPORT,
    colorScheme: 'light',
    // RN Web maps `testID` to `data-testid`; keep the default so no config drift.
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    phoneProject('iphone-chromium', {
      browserName: 'chromium',
      viewport: PHONE_VIEWPORT,
      deviceScaleFactor: 3,
      hasTouch: true,
      isMobile: true,
    }),
    phoneProject('iphone-webkit', {
      browserName: 'webkit',
      viewport: PHONE_VIEWPORT,
      deviceScaleFactor: 3,
      hasTouch: true,
      isMobile: true,
    }),
    phoneProject('small-phone-chromium', {
      browserName: 'chromium',
      viewport: SMALL_PHONE_VIEWPORT,
      deviceScaleFactor: 2,
      hasTouch: true,
      isMobile: true,
    }),
  ],
});
