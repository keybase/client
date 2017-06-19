// @flow
/* eslint-env mocha */
const process = require('process')
const path = require('path')
const crypto = require('crypto')
const wd = require('wd')

const serverConfig = {
  host: 'localhost',
  port: 4723,
}

const USERNAME = process.env['KB_USERNAME']
const PAPERKEY = process.env['KB_PAPERKEY']
const deviceNamePrefix = 'appium'

if (!USERNAME || !PAPERKEY) {
  console.error('Please set KB_USERNAME and KB_PAPERKEY env vars.')
  process.exit(1)
}

const desired = {
  platformName: 'Android',
  platformVersion: '7.0',
  automationName: 'uiautomator2',
  deviceName: 'Android Emulator',
  app: path.join(__dirname, '../shared/react-native/android/app/build/outputs/apk/app-debug.apk'),
}

describe('app', function() {
  this.timeout(5 * 60 * 1000)
  let driver
  let deviceName = deviceNamePrefix + '-' + crypto.randomBytes(8).toString('hex')

  before(function() {
    driver = wd.promiseChainRemote(serverConfig)
    return driver.init(desired).setImplicitWaitTimeout(30 * 1000)
  })

  after(function() {
    return driver
      .elementByAccessibilityId('Settings')
      .click()
      .elementByAccessibilityId('Devices')
      .click()
      .elementByAccessibilityId(`${deviceName} (current device)`)
      .click()
      .elementByAccessibilityId('Revoke this device')
      .click()
      .elementByAccessibilityId('Yes, delete it')
      .click()
      .waitForElementByAccessibilityId('Log in')
      .quit()
  })

  it('should be able to log in', function() {
    return driver
      .waitForElementByAccessibilityId('Log in')
      .elementByAccessibilityId('Log in')
      .click()
      .elementByAccessibilityId('Username or email')
      .type(USERNAME)
      .elementByAccessibilityId('Continue')
      .click()
      .elementByAccessibilityId('Use paper key "equip angle"')
      .click()
      .elementByAccessibilityId('Paper key')
      .type(PAPERKEY)
      .elementByAccessibilityId('Continue')
      .click()
      .elementByAccessibilityId('Device name')
      .type(deviceName)
      .elementByAccessibilityId('Continue')
      .click()
      .waitForElementByAccessibilityId('Edit profile')
  })
})
