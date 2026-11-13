import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from '@playwright/test';
const root = process.env.COMRADIA_ATLAS_ROOT;
if (!root) throw new Error('Use yarn test:atlas so every capture has an exclusive artifact root');
export default defineConfig({
  testDir: './tests/atlas',
  testMatch: 'capture.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 45000,
  expect: { timeout: 8000 },
  outputDir: `${root}/playwright`,
  reporter: [
    ['list'],
    ['json', { outputFile: `${root}/results.json` }],
    ['html', { outputFolder: `${root}/html`, open: 'never' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:8288',
    browserName: 'chromium',
    locale: 'en-US',
    colorScheme: 'light',
    deviceScaleFactor: 1,
    contextOptions: { reducedMotion: 'reduce' },
    trace: 'retain-on-failure',
  },
  projects: Object.entries(
    JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8')).viewports as Record<
      string,
      { width: number; height: number }
    >,
  ).map(([name, viewport]) => ({ name, use: { viewport } })),
  webServer: {
    command: 'npx expo start --web --localhost --port 8288',
    url: 'http://127.0.0.1:8288',
    reuseExistingServer: false,
    timeout: 300000,
    env: {
      COMRADIA_ATLAS: '1',
      CI: '1',
      BROWSER: 'none',
      EXPO_NO_TELEMETRY: '1',
      EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN: '',
      EXPO_PUBLIC_FIREBASE_EMULATOR_HOST: '127.0.0.1',
    },
  },
});
