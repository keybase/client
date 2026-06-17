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
