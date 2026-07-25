import {defineConfig} from '@playwright/test'

export default defineConfig({
  testDir: './',
  // several flows chain 3-4 five-second waits against a live service, so the
  // per-test budget has to clear the sum of their step timeouts
  timeout: 30_000,
  retries: 1,
  workers: 1,
  outputDir: '../../results/test-results',
  reporter: [
    ['list'],
    ['html', {outputFolder: '../../results/report', open: 'never'}],
    ['json', {outputFile: '../../results/report/results.json'}],
  ],
  use: {
    trace: 'on-first-retry',
    screenshot: 'on',
    video: 'off',
  },
  projects: [
    {name: 'electron-flows', testMatch: 'flows/**/*.test.ts'},
    {name: 'electron-flows-dark', testMatch: 'flows/**/*.test.ts'},
  ],
})
