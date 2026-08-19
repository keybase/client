import * as fs from 'fs'
import * as path from 'path'
import {homedir} from 'os'
import {iosCapabilities, udidForName, requireSmokeUser} from './helpers/app'
import {escapeToTabs} from './helpers/navigate'
import {consumeArtifactSkip} from './helpers/artifact'

// The xcuitest driver is installed under ~/.appium; the appium service spawns
// its own appium process, so point it at that home or it won't find the driver.
process.env['APPIUM_HOME'] ||= `${homedir()}/.appium`

requireSmokeUser()
const deviceName = process.env['KB_IOS_DEVICE'] ?? 'iPhoneTest'
// Where per-test artifacts (screenshot + status json) land for the HTML report.
// Relative to shared/ (the yarn cwd). Defaults to the fixed per-device dir
// generate-appium-report.mts reads, keyed off the device name, so even a direct
// `wdio run` lands its results in the right report slot.
const debugDir =
  process.env['KB_IOS_APPIUM_DEBUG_DIR'] ??
  (/pad/i.test(deviceName) ? 'tests/results/ios-appium-debug-ipad' : 'tests/results/ios-appium-debug-iphone')
const udid = process.env['KB_IOS_UDID'] ?? udidForName(deviceName)
// Parameterized so the parallel runner can give each device its own appium
// server + port (run-ios-appium-parallel.sh).
const port = Number(process.env['KB_APPIUM_PORT'] ?? 4723)
// Parallel runs give each device a distinct appium port; derive a matching WDA
// port (8100 + offset) so concurrent sims don't both grab 8100. Undefined when
// running on the default port (serial), keeping single-device runs on defaults.
const wdaLocalPort = port === 4723 ? undefined : 8100 + (port - 4723)
// 'LANDSCAPE' | 'PORTRAIT' — the runner sets LANDSCAPE for iPad.
const orientation = process.env['KB_IOS_ORIENTATION']
// Old-iOS sims (names ending in "Old", e.g. iOS 16.4) can't use the prebuilt
// WDA (built against the current SDK); they build their own into a per-device
// DerivedData dir so the build is cached and parallel builds don't collide.
const isOld = /old$/i.test(deviceName)
const derivedDataPath = isOld ? path.join(homedir(), '.appium', `wda-derived-${deviceName}`) : undefined

export const config: WebdriverIO.Config = {
  runner: 'local',
  port,
  path: '/',
  // One aggregate file → one session for the whole suite (see all.test.ts).
  // KB_IOS_SPEC overrides for fast single-flow iteration during development.
  specs: [process.env['KB_IOS_SPEC'] ?? './all.test.ts'],
  maxInstances: 1,
  capabilities: [iosCapabilities(udid, {wdaLocalPort, prebuilt: !isOld, derivedDataPath})],
  logLevel: 'warn',
  framework: 'mocha',
  // 120s: the tablet settings-subpages flow can run long; phone tests finish well
  // under this.
  //
  // retries: 0. The claim this used to carry — "a real break fails all attempts" —
  // is not true of every flow: a chat-search regression that failed three runs in
  // four was reported green here, because a retry cannot tell a slow simulator
  // from a thread that scrolled itself. Retries are opt-in per flow now: a flow
  // that is genuinely load-sensitive calls this.retries(n) in its describe and
  // says why, which keeps the cost visible where someone can judge it.
  mochaOpts: {ui: 'bdd', timeout: 120000, retries: 0},
  reporters: ['spec'],
  services: [['appium', {args: {basePath: '/', port}}]],
  // Set device orientation once at session start (e.g. iPad in landscape).
  before: async () => {
    if (orientation) await browser.setOrientation(orientation as 'LANDSCAPE' | 'PORTRAIT').catch(() => {})
  },
  // The app restores its last screen on launch and screens leak between specs,
  // so reset to the root tab bar before each test by climbing out of any stack.
  // (Cheaper + more reliable than a cold relaunch, which also restores state.)
  beforeTest: async test => {
    // eslint-disable-next-line no-console
    console.log(`▶ ${new Date().toLocaleTimeString()} starting: ${test.title}`)
    await escapeToTabs()
  },
  // Tests deliberately END on the state they capture (often an open modal), so
  // park the app back at the tab root when the session closes — otherwise the
  // last test's modal is what you find on the simulator after a run.
  after: async () => {
    await escapeToTabs().catch(() => {})
  },
  // Emit a screenshot + status json per test so generate-appium-report.mts can
  // build the unified HTML report (one card per test).
  afterTest: async (test, _context, result: {passed: boolean; duration: number; error?: Error}) => {
    // A test that bailed out because it had nothing new to capture (e.g. a
    // screenful past the end of a page) writes no artifacts, so the report
    // doesn't gain a duplicate card. mocha's this.skip() can't drive this:
    // wdio's afterTest never sees the pending flag.
    if (consumeArtifactSkip()) {
      // eslint-disable-next-line no-console
      console.log(`- ${new Date().toLocaleTimeString()} ${test.title} (nothing new)`)
      return
    }
    // eslint-disable-next-line no-console
    console.log(
      `${result.passed ? '✓' : '✗'} ${new Date().toLocaleTimeString()} ${test.title} (${(result.duration / 1000).toFixed(1)}s)`
    )
    fs.mkdirSync(debugDir, {recursive: true})
    const slug = `${test.parent} ${test.title}`.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '')
    const screenshotPath = path.join(debugDir, `${slug}.png`)
    await browser.saveScreenshot(screenshotPath).catch(() => {})
    fs.writeFileSync(
      path.join(debugDir, `${slug}.json`),
      JSON.stringify({
        label: `${test.parent} › ${test.title}`,
        passed: result.passed,
        durationMs: result.duration,
        error: result.error?.message ?? null,
      })
    )
  },
}
