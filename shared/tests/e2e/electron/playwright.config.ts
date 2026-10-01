import {defineConfig} from '@playwright/test'

// The chat flows over the seeded e2e team. They check behaviour, not colours, so they run in the
// light project only; each also turns retries off for itself (a retry would let an intermittent
// scroll race pass).
const chatFlows = ['composer', 'data', 'parity', 'scroll', 'selection'].map(n => `flows/chat-${n}.test.ts`)

export default defineConfig({
  testDir: './',
  // aborts the run in seconds when the dev app's renderer does not load (see global-setup.ts)
  globalSetup: './global-setup.ts',
  // several flows chain 3-4 five-second waits against a live service, so the
  // per-test budget has to clear the sum of their step timeouts. Worst case is
  // flows/teams-modals 'retention warning opens': openFirstTeam (~8s) + two 5s
  // visibility waits + 3 reopen attempts of 5s settle + 2s menu wait each + a 3s
  // confirm wait, which is over 30s of step budget on its own.
  timeout: 30_000,
  // A whole run never waits longer than this, whatever gets stuck (KB_E2E_GLOBAL_TIMEOUT_MIN to change).
  // It has to clear a first run's seeding of the chat data (up to 20 minutes: it waits out the
  // service's chat rate limit) plus the chat flows (80 cases, a dozen of them allowed 90-180s) and
  // every other flow.
  globalTimeout: Number(process.env['KB_E2E_GLOBAL_TIMEOUT_MIN'] ?? 60) * 60_000,
  expect: {timeout: 5_000},
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
    {name: 'electron-flows-dark', testIgnore: chatFlows, testMatch: 'flows/**/*.test.ts'},
  ],
})
