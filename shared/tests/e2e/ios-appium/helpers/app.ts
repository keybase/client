import {execSync} from 'child_process'

export function udidForName(name: string): string {
  const json = execSync('xcrun simctl list devices available -j', {encoding: 'utf8'})
  const devices = (JSON.parse(json) as {devices: Record<string, Array<{name: string; udid: string}>>}).devices
  for (const runtime of Object.keys(devices)) {
    for (const d of devices[runtime] ?? []) {
      if (d.name === name) return d.udid
    }
  }
  throw new Error(`Simulator not found: ${name}`)
}

export function requireSmokeUser(): string {
  const u = process.env['KB_SMOKE_USER']
  if (!u) throw new Error('KB_SMOKE_USER is not set — set it to the expected logged-in username')
  return u
}

// First connected adb device serial (or KB_ANDROID_SERIAL when set, for multi-
// device hosts). `adb devices` lists one "serial\tdevice" line per attached
// device; we take the first in "device" state (skips "offline"/"unauthorized").
export function androidSerial(): string {
  const override = process.env['KB_ANDROID_SERIAL']
  if (override) return override
  const out = execSync('adb devices', {encoding: 'utf8'})
  for (const line of out.split('\n').slice(1)) {
    const [serial, state] = line.trim().split(/\s+/)
    if (serial && state === 'device') return serial
  }
  throw new Error('No connected Android device found (adb devices) — plug one in or set KB_ANDROID_SERIAL')
}

// The installed Keybase Android app. Driven black-box like iOS (no rebuild):
// UiAutomator2 attaches to the already-installed package and launches the
// launcher activity.
const ANDROID_PACKAGE = 'io.keybase.ossifrage'
const ANDROID_ACTIVITY = '.MainActivity'

export function androidCapabilities(serial: string) {
  return {
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:udid': serial,
    'appium:appPackage': ANDROID_PACKAGE,
    'appium:appActivity': ANDROID_ACTIVITY,
    // Attach to the installed app; never wipe its data/login between runs.
    'appium:noReset': true,
    'appium:newCommandTimeout': 120,
    // ATTACH to the already-running app — do NOT kill/relaunch it. The phone
    // runs a DEBUGGABLE build that loads JS from Metro; force-relaunching it
    // reconnects to Metro and reliably lands on a BLANK RN root (white screen,
    // no views) that never recovers within a session. So the user launches the
    // app to a healthy state once and the suite attaches; beforeTest's
    // escapeToTabs normalizes to the tab root.
    'appium:forceAppLaunch': false,
    'appium:autoLaunch': false,
    'appium:appWaitActivity': '*',
    // Faster, steadier UI automation: skip view-server animations and don't
    // wait for app idle on every command.
    'appium:disableWindowAnimation': true,
    'appium:waitForIdleTimeout': 0,
    'appium:ignoreHiddenApiPolicyError': true,
  }
}

interface IosCapsOpts {
  wdaLocalPort?: number
  // false for old-iOS sims (e.g. iOS 16.4): the single prebuilt WDA is built
  // against the current (iOS 26) SDK and will not launch on an old runtime
  // (WDA never binds 8100 → "Unable to start WebDriverAgent session ...
  // ECONNREFUSED 127.0.0.1:8100"). Those sims must build their own WDA.
  prebuilt?: boolean
  // Per-device DerivedData dir so an old sim's freshly-built WDA is cached
  // between runs and concurrent old-sim builds don't clobber each other.
  derivedDataPath?: string
}

export function iosCapabilities(udid: string, opts: IosCapsOpts = {}) {
  const {wdaLocalPort, prebuilt = true, derivedDataPath} = opts
  return {
    platformName: 'iOS',
    'appium:automationName': 'XCUITest',
    'appium:udid': udid,
    'appium:bundleId': 'keybase.ios',
    'appium:noReset': true,
    'appium:newCommandTimeout': 120,
    // A fresh WDA build (prebuilt: false) runs xcodebuild and can take minutes
    // the first time; the prebuilt path launches in seconds.
    'appium:wdaLaunchTimeout': prebuilt ? 120000 : 600000,
    // Speed up session init / commands: don't wait for app quiescence on launch
    // and skip device log capture.
    'appium:waitForIdleTimeout': 0,
    'appium:skipLogCapture': true,
    // Reuse the prebuilt WDA read-only (safe concurrently across modern sims).
    // Old sims build their own WDA into their own derivedDataPath instead.
    ...(prebuilt ? {'appium:usePrebuiltWDA': true} : {}),
    ...(derivedDataPath ? {'appium:derivedDataPath': derivedDataPath} : {}),
    // WDA listens on 8100 by default; the parallel runner (run-ios-appium-parallel.sh)
    // runs sims at once, so each needs its OWN WDA port or the second WDA
    // collides with the first (connect ECONNREFUSED 127.0.0.1:8100, sessions die
    // mid-suite). Serial runs leave the port undefined.
    ...(wdaLocalPort
      ? {
          'appium:wdaLocalPort': wdaLocalPort,
          'appium:mjpegServerPort': wdaLocalPort + 100,
        }
      : {}),
  }
}
