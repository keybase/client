import {homedir} from 'os'
import {iosCapabilities, udidForName, requireSmokeUser} from './helpers/app'

// The xcuitest driver is installed under ~/.appium; the appium service spawns
// its own appium process, so point it at that home or it won't find the driver.
process.env['APPIUM_HOME'] ||= `${homedir()}/.appium`

requireSmokeUser()
const deviceName = process.env['KB_IOS_DEVICE'] ?? 'iPhoneTest'
const udid = process.env['KB_IOS_UDID'] ?? udidForName(deviceName)
const bundleId = 'keybase.ios'

export const config: WebdriverIO.Config = {
  runner: 'local',
  port: 4723,
  path: '/',
  specs: ['./flows/**/*.test.ts'],
  maxInstances: 1,
  capabilities: [iosCapabilities(udid)],
  logLevel: 'warn',
  framework: 'mocha',
  mochaOpts: {ui: 'bdd', timeout: 60000},
  reporters: ['spec'],
  services: [['appium', {args: {basePath: '/'}}]],
  // Reset each spec to the app's root tabs. noReset attaches to the live app,
  // so without this a prior spec's deep screen leaks into the next one and
  // escapeToTabs can't always climb back out.
  beforeTest: async () => {
    await browser.execute('mobile: terminateApp', {bundleId})
    await browser.execute('mobile: activateApp', {bundleId})
    await browser.pause(1500)
  },
}
