import * as fs from 'fs'
import * as path from 'path'
import {config as base} from './wdio.conf'
import {e2eAccounts, ensureChatData} from '../shared/chat-data'
import {switchCliAccount} from '../shared/cli-account'
import {hideKeyboard, switchAppAccount} from './helpers/chat'
import {BUNDLE_ID, jsEval, metroClientLogSince, metroLogMark, waitFor} from './helpers/lifecycle'
import {escapeToTabs} from './helpers/navigate'

// The chat flows (chat.test.ts), in their own session: they need the seeded e2e team data, the app
// signed in as KB_SMOKE_USER, and the host's keybase CLI signed in as KB_SECOND_USER to send
// "incoming" messages. They assert on the thread as the app holds it and on element state, never
// on screenshots, and run without retries: a flake is a bug in a wait or in the app, and a retry
// would hide either.
const debugDir = process.env['KB_IOS_APPIUM_DEBUG_DIR'] ?? 'tests/results/ios-appium-chat-iphone'

let mark: ReturnType<typeof metroLogMark> | undefined

export const config: WebdriverIO.Config = {
  ...base,
  specs: [process.env['KB_IOS_SPEC'] ?? './chat.test.ts'],
  // 7 minutes: the paging flows drag through 400 messages a step at a time
  mochaOpts: {bail: false, retries: 0, timeout: 420_000, ui: 'bdd'},
  before: async () => {
    const {secondUser, smokeUser} = e2eAccounts()
    const foreground = 4
    if ((await browser.execute('mobile: queryAppState', {bundleId: BUNDLE_ID})) !== foreground) {
      await browser.execute('mobile: activateApp', {bundleId: BUNDLE_ID})
    }
    // The runner relaunched the app for the current bundle; the JS runtime found must have started
    // since (Metro's bundle prelude stamps when it ran).
    const relaunchedAt = Number(process.env['KB_IOS_RELAUNCHED_AT'] ?? 0)
    if (relaunchedAt) {
      await waitFor(
        'a JS runtime started since the relaunch',
        async () => {
          const age = await jsEval<number>(
            `const now = globalThis.nativePerformanceNow ? globalThis.nativePerformanceNow() : Date.now(); return now - globalThis.__BUNDLE_START_TIME__`
          )
          return Date.now() - age >= relaunchedAt - 1_000 ? true : undefined
        },
        {interval: 1_000, timeout: 90_000}
      )
    }
    // seeding sends as the team's owner
    await switchCliAccount(smokeUser)
    await ensureChatData()
    await switchAppAccount(smokeUser)
    await switchCliAccount(secondUser)
  },
  beforeTest: async test => {
     
    console.log(`▶ ${new Date().toLocaleTimeString()} starting: ${test.parent} › ${test.title}`)
    mark = metroLogMark()
    await hideKeyboard()
    await escapeToTabs()
  },
  // The app's console errors during the test go into its result, for the report and for triage.
  afterTest: (test, _context, result: {passed: boolean; duration: number; error?: Error}) => {
     
    // a flow that skips itself (this.skip()) ends neither passed nor with an error
    const skipped = !result.passed && !result.error
    console.log(
      `${result.passed ? '✓' : skipped ? '-' : '✗'} ${new Date().toLocaleTimeString()} ${test.title} (${(result.duration / 1000).toFixed(1)}s)`
    )
    const appErrors = mark ? metroClientLogSince(mark, 'error').slice(0, 50) : []
    fs.mkdirSync(debugDir, {recursive: true})
    const slug = `${test.parent} ${test.title}`.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '')
    fs.writeFileSync(
      path.join(debugDir, `${slug}.json`),
      JSON.stringify({
        appErrors,
        durationMs: result.duration,
        error: result.error?.message ?? null,
        label: `${test.parent} › ${test.title}`,
        passed: result.passed,
        skipped,
      })
    )
  },
  after: async () => {
    await hideKeyboard().catch(() => {})
    await escapeToTabs().catch(() => {})
    await switchCliAccount(e2eAccounts().smokeUser)
  },
}
