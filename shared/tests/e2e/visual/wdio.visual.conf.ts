// The iOS visual driver opens a standalone webdriverio `remote()` session itself (no specs, no
// mocha); this config carries the same port and capabilities for `wdio` tooling that wants one.
import type {Capabilities, Options} from '@wdio/types'
import {udidForName} from '../ios-appium/helpers/app.ts'
import {appiumPort, visualCapabilities} from './driver-ios.mts'

export const config: Options.Testrunner & Capabilities.WithRequestedTestrunnerCapabilities = {
  capabilities: [visualCapabilities(process.env['KB_IOS_UDID'] ?? udidForName(process.env['KB_IOS_DEVICE'] ?? 'iPhoneTest'))],
  logLevel: 'warn',
  maxInstances: 1,
  path: '/',
  port: appiumPort(),
  runner: 'local',
  specs: [],
}
