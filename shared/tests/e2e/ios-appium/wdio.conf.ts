import {iosCapabilities, udidForName, requireSmokeUser} from './helpers/app'

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
}
