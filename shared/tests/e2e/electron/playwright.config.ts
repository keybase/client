import {defineConfig} from '@playwright/test'

export default defineConfig({
  testDir: './',
  timeout: 30_000,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', {outputFolder: '/tmp/playwright-report', open: 'never'}]],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {name: 'electron-smoke', testMatch: 'smoke/**/*.test.ts'},
    {name: 'electron-flows', testMatch: 'flows/**/*.test.ts'},
  ],
})
