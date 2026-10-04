/* eslint-disable @typescript-eslint/no-floating-promises */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {ACCESSIBILITY_KEYS, STATUS_BAR_ARGS, appiumPort, iosCleanupCommands, visualCapabilities} from './driver-ios.mts'

const withPort = <T,>(port: string | undefined, f: () => T): T => {
  const saved = process.env['KB_APPIUM_PORT']
  if (port === undefined) delete process.env['KB_APPIUM_PORT']
  else process.env['KB_APPIUM_PORT'] = port
  try {
    return f()
  } finally {
    if (saved === undefined) delete process.env['KB_APPIUM_PORT']
    else process.env['KB_APPIUM_PORT'] = saved
  }
}

test('status bar override pins 9:41, full wifi/cell bars and a charged battery', () => {
  assert.deepEqual(
    [...STATUS_BAR_ARGS],
    [
      '--time', '9:41',
      '--dataNetwork', 'wifi',
      '--wifiMode', 'active',
      '--wifiBars', '3',
      '--cellularMode', 'active',
      '--cellularBars', '4',
      '--batteryState', 'charged',
      '--batteryLevel', '100',
    ]
  )
})

test('reduce motion and reduce transparency are the accessibility settings a run turns on', () => {
  assert.deepEqual([...ACCESSIBILITY_KEYS], ['ReduceMotionEnabled', 'EnhancedBackgroundContrastEnabled'])
})

test('default Appium port keeps the default WDA port', () => {
  withPort(undefined, () => {
    assert.equal(appiumPort(), 4723)
    const caps = visualCapabilities('udid-1') as Record<string, unknown>
    assert.equal(caps['appium:udid'], 'udid-1')
    assert.equal(caps['appium:bundleId'], 'keybase.ios')
    assert.equal(caps['appium:noReset'], true)
    assert.equal(caps['appium:wdaLocalPort'], undefined)
  })
})

test('another Appium port gets its own WDA port', () => {
  withPort('4725', () => {
    assert.equal(appiumPort(), 4725)
    const caps = visualCapabilities('udid-1') as Record<string, unknown>
    assert.equal(caps['appium:wdaLocalPort'], 8102)
  })
})

test('cleanup commands undo what prepare changed, then relaunch the app and stop Appium', () => {
  const original = {
    accessibility: [
      {key: 'ReduceMotionEnabled', value: undefined},
      {key: 'EnhancedBackgroundContrastEnabled', value: '0'},
    ],
    appearance: 'dark',
  }
  assert.deepEqual(iosCleanupCommands({appium: true, original, port: 4723, udid: 'U'}), [
    'xcrun simctl status_bar U clear',
    'xcrun simctl ui U appearance dark',
    'xcrun simctl spawn U defaults delete com.apple.Accessibility ReduceMotionEnabled',
    'xcrun simctl spawn U defaults write com.apple.Accessibility EnhancedBackgroundContrastEnabled -bool false',
    'xcrun simctl terminate U keybase.ios; xcrun simctl launch U keybase.ios',
    "kill $(lsof -t -iTCP:4723 -sTCP:LISTEN)   # the gate's Appium",
  ])
  // before prepare touched the simulator, only Appium is left to stop
  assert.deepEqual(iosCleanupCommands({appium: true, original: undefined, port: 4724, udid: 'U'}), [
    "kill $(lsof -t -iTCP:4724 -sTCP:LISTEN)   # the gate's Appium",
  ])
  assert.deepEqual(iosCleanupCommands({appium: false, original: undefined, port: 4723, udid: 'U'}), [])
})
