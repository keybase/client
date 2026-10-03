/* eslint-disable @typescript-eslint/no-floating-promises */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {ACCESSIBILITY_KEYS, STATUS_BAR_ARGS, appiumPort, visualCapabilities} from './driver-ios.mts'

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
