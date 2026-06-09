import {homedir} from 'os'
import {iosCapabilities, udidForName, requireSmokeUser} from './helpers/app'
import {escapeToTabs} from './helpers/navigate'

// The xcuitest driver is installed under ~/.appium; the appium service spawns
// its own appium process, so point it at that home or it won't find the driver.
process.env['APPIUM_HOME'] ||= `${homedir()}/.appium`

requireSmokeUser()
const deviceName = process.env['KB_IOS_DEVICE'] ?? 'iPhoneTest'
const udid = process.env['KB_IOS_UDID'] ?? udidForName(deviceName)

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
  // The app restores its last screen on launch and screens leak between specs,
  // so reset to the root tab bar before each test by climbing out of any stack.
  // (Cheaper + more reliable than a cold relaunch, which also restores state.)
  beforeTest: async () => {
    await escapeToTabs()
  },
}
