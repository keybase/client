import * as fs from 'fs'
import * as path from 'path'
import {homedir} from 'os'
import {androidCapabilities, androidSerial, requireSmokeUser} from './helpers/app'
import {escapeToTabs} from './helpers/navigate'

// The uiautomator2 driver is installed under ~/.appium; the appium service
// spawns its own appium process, so point it at that home or it won't find the
// driver.
process.env['APPIUM_HOME'] ||= `${homedir()}/.appium`

requireSmokeUser()
const serial = androidSerial()
// Where per-test artifacts (screenshot + status json) land for the HTML report.
// Relative to shared/ (the yarn cwd). Single Android slot (one connected phone).
const debugDir = process.env['KB_ANDROID_APPIUM_DEBUG_DIR'] ?? 'tests/results/android-appium-debug'
const port = Number(process.env['KB_APPIUM_PORT'] ?? 4723)

export const config: WebdriverIO.Config = {
  runner: 'local',
  port,
  path: '/',
  // One aggregate file → one session for the whole suite (see all.test.ts).
  // KB_ANDROID_SPEC: run a single flow file instead, for fast iteration.
  specs: [process.env['KB_ANDROID_SPEC'] ?? './all.test.ts'],
  maxInstances: 1,
  capabilities: [androidCapabilities(serial)],
  logLevel: 'warn',
  framework: 'mocha',
  // Mirrors the iOS config: the one-session suite accumulates load over many
  // flows; retries: 2 (each with a fresh escapeToTabs reset) absorbs transient
  // nav/list flake without masking real failures. Retries run ONLY on failure.
  mochaOpts: {ui: 'bdd', timeout: 120000, retries: 2},
  reporters: ['spec'],
  services: [['appium', {args: {basePath: '/', port}}]],
  // The app restores its last screen on launch and screens leak between specs,
  // so reset to the root tab bar before each test by climbing out of any stack.
  beforeTest: async test => {
    // eslint-disable-next-line no-console
    console.log(`▶ ${new Date().toLocaleTimeString()} starting: ${test.title}`)
    // KB_SKIP_RESET: for probe/debug specs that must run even when the reset
    // itself is what's broken.
    if (process.env['KB_SKIP_RESET']) return
    await escapeToTabs()
    // eslint-disable-next-line no-console
    console.log(`  ${new Date().toLocaleTimeString()} at tab root, running: ${test.title}`)
  },
  // Emit a screenshot + status json per test so generate-appium-report.mts can
  // build the unified HTML report (one card per test).
  afterTest: async (test, _context, result: {passed: boolean; duration: number; error?: Error}) => {
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
