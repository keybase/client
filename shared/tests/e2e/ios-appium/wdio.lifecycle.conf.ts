import * as fs from 'fs'
import * as path from 'path'
import {config as base} from './wdio.conf'
import {waitForAppState} from './helpers/lifecycle'
import {escapeToTabs} from './helpers/navigate'

// App lifecycle flows (launch, background, deep links, push, live location). They
// kill, background and relaunch the app, so they run in their own session instead of
// the main suite. They validate with app state and logs only: no screenshots.
const debugDir = process.env['KB_IOS_APPIUM_DEBUG_DIR'] ?? 'tests/results/ios-appium-lifecycle-iphone'

export const config: WebdriverIO.Config = {
  ...base,
  specs: [process.env['KB_IOS_SPEC'] ?? './lifecycle.test.ts'],
  // Xcode 27 has no Simulator.app for the driver to open (its window is DeviceHub now), and
  // the driver fails the session when it can't. The runner boots the simulator and shows it.
  // Flows wait minutes on logs without sending a command (a relaunch for a location change,
  // a map post that times out), so the session must outlive the default idle timeout.
  capabilities: (base.capabilities as Array<Record<string, unknown>>).map(c => ({
    ...c,
    'appium:isHeadless': true,
    'appium:newCommandTimeout': 900,
  })),
  // A lifecycle regression is often intermittent, so a retry would hide exactly what
  // these flows exist to catch.
  mochaOpts: {bail: false, retries: 0, timeout: 420000, ui: 'bdd'},
  // A failed flow can leave the app in the background or not running; bring it back before
  // resetting to the tab root, or every later flow fails in its reset.
  beforeTest: async test => {
    // eslint-disable-next-line no-console
    console.log(`▶ ${new Date().toLocaleTimeString()} starting: ${test.title}`)
    const foreground = 4
    if ((await browser.execute('mobile: queryAppState', {bundleId: 'keybase.ios'})) !== foreground) {
      await browser.execute('mobile: activateApp', {bundleId: 'keybase.ios'})
    }
    // A just-launched app is still loading its screens; resetting before then misses taps.
    await waitForAppState('active', undefined, 90000)
    await escapeToTabs()
  },
  afterTest: (test, _context, result: {passed: boolean; duration: number; error?: Error}) => {
    // eslint-disable-next-line no-console
    console.log(
      `${result.passed ? '✓' : '✗'} ${new Date().toLocaleTimeString()} ${test.title} (${(result.duration / 1000).toFixed(1)}s)`
    )
    fs.mkdirSync(debugDir, {recursive: true})
    const slug = `${test.parent} ${test.title}`.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '')
    fs.writeFileSync(
      path.join(debugDir, `${slug}.json`),
      JSON.stringify({
        durationMs: result.duration,
        error: result.error?.message ?? null,
        label: `${test.parent} › ${test.title}`,
        passed: result.passed,
      })
    )
  },
}
