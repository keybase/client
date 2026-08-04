import {defineConfig} from '@playwright/test'

export default defineConfig({
  testDir: './',
  // several flows chain 3-4 five-second waits against a live service, so the
  // per-test budget has to clear the sum of their step timeouts. Worst case is
  // flows/teams-modals 'retention warning opens': openFirstTeam (~8s) + two 5s
  // visibility waits + 3 reopen attempts of 5s settle + 2s menu wait each + a 3s
  // confirm wait, which is over 30s of step budget on its own.
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
