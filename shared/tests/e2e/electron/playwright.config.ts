import {defineConfig} from '@playwright/test'

export default defineConfig({
  testDir: './',
  timeout: 15_000,
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
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    {name: 'electron-smoke', testMatch: 'smoke/**/*.test.ts'},
    {name: 'electron-flows', testMatch: 'flows/**/*.test.ts'},
  ],
})
