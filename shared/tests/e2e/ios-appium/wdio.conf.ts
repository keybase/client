import * as fs from 'fs'
import * as path from 'path'
import {homedir} from 'os'
import {iosCapabilities, udidForName, requireSmokeUser} from './helpers/app'
import {escapeToTabs} from './helpers/navigate'

// Where per-test artifacts (screenshot + status json) land for the HTML report.
// Relative to shared/ (the yarn cwd), matching generate-appium-report.mts and
// the tests/results/ convention used by the maestro debug output.
const debugDir = process.env['KB_IOS_APPIUM_DEBUG_DIR'] ?? 'tests/results/ios-appium-debug'

// The xcuitest driver is installed under ~/.appium; the appium service spawns
// its own appium process, so point it at that home or it won't find the driver.
process.env['APPIUM_HOME'] ||= `${homedir()}/.appium`

requireSmokeUser()
const deviceName = process.env['KB_IOS_DEVICE'] ?? 'iPhoneTest'
const udid = process.env['KB_IOS_UDID'] ?? udidForName(deviceName)
// Parameterized so the parallel runner can give each device its own appium
// server + port (run-ios-appium-parallel.sh).
const port = Number(process.env['KB_APPIUM_PORT'] ?? 4723)
// 'LANDSCAPE' | 'PORTRAIT' — the runner sets LANDSCAPE for iPad.
const orientation = process.env['KB_IOS_ORIENTATION']

export const config: WebdriverIO.Config = {
  runner: 'local',
  port,
  path: '/',
  // One aggregate file → one session for the whole suite (see all.test.ts).
  specs: ['./all.test.ts'],
  maxInstances: 1,
  capabilities: [iosCapabilities(udid)],
  logLevel: 'warn',
  framework: 'mocha',
  // 120s: the tablet settings-subpages flow (8 subpages, two-pane scroll+retry)
  // can run long; phone tests finish well under this.
  mochaOpts: {ui: 'bdd', timeout: 120000},
  reporters: ['spec'],
  services: [['appium', {args: {basePath: '/', port}}]],
  // Set device orientation once at session start (e.g. iPad in landscape).
  before: async () => {
    if (orientation) await browser.setOrientation(orientation as 'LANDSCAPE' | 'PORTRAIT').catch(() => {})
  },
  // The app restores its last screen on launch and screens leak between specs,
  // so reset to the root tab bar before each test by climbing out of any stack.
  // (Cheaper + more reliable than a cold relaunch, which also restores state.)
  beforeTest: async () => {
    await escapeToTabs()
  },
  // Emit a screenshot + status json per test so generate-appium-report.mts can
  // build the unified HTML report (one card per test).
  afterTest: async (test, _context, result: {passed: boolean; duration: number; error?: Error}) => {
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
