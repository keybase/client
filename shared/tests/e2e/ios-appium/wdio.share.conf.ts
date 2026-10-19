import * as fs from 'fs'
import * as path from 'path'
import {config as base} from './wdio.conf'
import {BUNDLE_ID} from './helpers/lifecycle'
import {escapeToTabs} from './helpers/navigate'
import {leaveSharePicker, prepareSelfConversation, shareDebugDir} from './helpers/share'

// The share-source matrix (share.test.ts): every source shares from another app's share sheet into
// Keybase, then sends into the smoke user's conversation with themselves. Local only; never in CI.
//
// Run it through tests/e2e/run-ios-share.sh, which makes the assets, relaunches the app on the current
// bundle and puts a deadline on the run. It needs:
// - KB_SMOKE_USER: the account the simulator's app is signed in to. Nothing is sent unless the app is
//   signed in as exactly this account, and only to the conversation whose one participant it is.
// - a booted simulator (KB_IOS_DEVICE, default iPhoneTest) with a signed debug build installed. Build
//   with signing: a build with CODE_SIGNING_ALLOWED=NO has no app group, and installing one deletes
//   the group's data, which signs the app out.
// - Metro running from this checkout.
// KB_SHARE_NO_SEND=1 stops every source at the app's share screen; KB_IOS_GREP picks sources.
//
// Results: one <source>.result.json per source (the manifest, the extension's log lines, what was
// sent) plus a screenshot per test, in tests/results/ios-appium-share-<device>.
export const config: WebdriverIO.Config = {
  ...base,
  specs: [process.env['KB_IOS_SPEC'] ?? './share.test.ts'],
  // Large videos upload for minutes. A share is often flaky rather than broken, so a retry would hide
  // exactly what this suite exists to find.
  mochaOpts: {bail: false, grep: process.env['KB_IOS_GREP'], retries: 0, timeout: 600_000, ui: 'bdd'},
  capabilities: (base.capabilities as Array<Record<string, unknown>>).map(c => ({
    ...c,
    'appium:newCommandTimeout': 900,
  })),
  before: async () => {
    try {
      await prepareSelfConversation()
    } catch (e) {
      console.error(`❌ share matrix setup failed, stopping the run: ${e instanceof Error ? e.message : String(e)}`)
      process.exit(1)
    }
  },
  beforeTest: async test => {
    console.log(`▶ ${new Date().toLocaleTimeString()} starting: ${test.parent} › ${test.title}`)
    const foreground = 4
    if ((await browser.execute('mobile: queryAppState', {bundleId: BUNDLE_ID})) !== foreground) {
      await browser.execute('mobile: activateApp', {bundleId: BUNDLE_ID})
    }
    // A share left on the picker is closed by its own Cancel first: escaping from the picker can pick a
    // conversation. If that fails, don't escape at all; the test fails on the screen it finds.
    try {
      await leaveSharePicker()
      await escapeToTabs()
    } catch (e) {
      console.error(`beforeTest: ${e instanceof Error ? e.message : String(e)}`)
    }
  },
  afterTest: async (test, _context, result: {passed: boolean; duration: number; error?: Error}) => {
    const skipped = !result.passed && !result.error
    console.log(
      `${result.passed ? '✓' : skipped ? '-' : '✗'} ${new Date().toLocaleTimeString()} ${test.title} (${(result.duration / 1000).toFixed(1)}s)`
    )
    const dir = shareDebugDir()
    const slug = `${test.parent} ${test.title}`.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '')
    await browser.saveScreenshot(path.join(dir, `${slug}.png`)).catch(() => {})
    fs.writeFileSync(
      path.join(dir, `${slug}.json`),
      JSON.stringify({
        durationMs: result.duration,
        error: result.error?.message ?? null,
        label: `${test.parent} › ${test.title}`,
        passed: result.passed,
        skipped,
      })
    )
  },
}
