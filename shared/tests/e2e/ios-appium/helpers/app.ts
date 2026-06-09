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

export function iosCapabilities(udid: string) {
  return {
    platformName: 'iOS',
    'appium:automationName': 'XCUITest',
    'appium:udid': udid,
    'appium:bundleId': 'keybase.ios',
    'appium:noReset': true,
    'appium:newCommandTimeout': 120,
    'appium:wdaLaunchTimeout': 120000,
    // Speed up session init / commands: don't wait for app quiescence on launch,
    // reuse the prebuilt WDA, and skip device log capture.
    'appium:waitForIdleTimeout': 0,
    'appium:usePrebuiltWDA': true,
    'appium:skipLogCapture': true,
  }
}
