/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers top-level tests; they are not awaited */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'fs'
import {
  classifyFormFactor,
  formFactorLabel,
  formFactorMismatch,
  formFactorStoreKey,
  parseScreenTarget,
  readFormFactor,
  restartSimulator,
  screenshotDisplayOf,
  setPosture,
  simctlScreenshot,
  touchInner,
  type Exec,
} from './form-factor.mts'

const DUO = 'com.apple.CoreSimulator.SimDeviceType.iPhone-Duo'
const PHONE = 'com.apple.CoreSimulator.SimDeviceType.iPhone-18-Pro'
const IPAD = 'com.apple.CoreSimulator.SimDeviceType.iPad-Pro-13-inch-M5-12GB'
// devicectl's display rows: `lit` is backlightState activeOn
const outer = (lit: boolean, active = lit) => ({active, backlightState: lit ? 'activeOn' : 'off', displayId: 1, primary: true})
const inner = (lit: boolean, active = lit) => ({active, backlightState: lit ? 'activeOn' : 'off', displayId: 3, primary: false})

test('a plain iPhone is iphone and never needs its displays', () => {
  assert.equal(classifyFormFactor(PHONE, undefined), 'iphone')
})

test('an iPad is labeled by its model', () => {
  assert.equal(classifyFormFactor(IPAD, undefined), 'ipad')
})

test('a Duo is folded when the outer (primary) screen is active, unfolded when the inner one is', () => {
  assert.equal(classifyFormFactor(DUO, [outer(true), inner(false)]), 'duo-folded')
  assert.equal(classifyFormFactor(DUO, [outer(false), inner(true)]), 'duo-unfolded')
})

// Seen live 2026-11-17: after a fold the outer screen lit and showed the home screen while `active`
// still named the inner one, and stayed that way.
test('a Duo trusts the lit screen over a stale active flag', () => {
  assert.equal(classifyFormFactor(DUO, [outer(true, false), inner(false, true)]), 'duo-folded')
})

test('a Duo with no active screen throws', () => {
  assert.throws(() => classifyFormFactor(DUO, [outer(false), inner(false)]), /no active display/)
})

test('labels and store keys', () => {
  assert.equal(formFactorLabel('iphone'), 'iPhone')
  assert.equal(formFactorLabel('duo-folded'), 'iPhone Duo Folded')
  assert.equal(formFactorLabel('duo-unfolded'), 'iPhone Duo Unfolded')
  assert.equal(formFactorLabel('duo-split-left'), 'iPhone Duo Split Left')
  assert.equal(formFactorLabel('duo-split-right'), 'iPhone Duo Split Right')
  assert.equal(formFactorLabel('ipad'), 'iPad')
  assert.equal(formFactorLabel('vision'), 'vision')
  assert.equal(formFactorStoreKey('iphone'), 'ios')
  assert.equal(formFactorStoreKey('duo-folded'), 'ios-duo-folded')
  assert.equal(formFactorStoreKey('duo-unfolded'), 'ios-duo-unfolded')
})

// A fake simctl/devicectl: the device type, the hinge angle the helper reports, and the displays
// devicectl reports on each call (the last one repeats).
const fakeDevice = (deviceType: string, displays: Array<Array<ReturnType<typeof outer>>>, angle = '180.0') => {
  const calls: Array<Array<string>> = []
  let displayCall = 0
  const exec: Exec = (file, args) => {
    calls.push([file, ...args])
    if (args.includes('list')) {
      return JSON.stringify({devices: {'ios-27': [{deviceTypeIdentifier: deviceType, name: 'x', udid: 'U'}]}})
    }
    if (args.includes('displays')) {
      const d = displays[Math.min(displayCall++, displays.length - 1)]
      return JSON.stringify({result: {displays: d}})
    }
    if (args.includes('spawn') && args.includes('get')) return `${angle}\n`
    return ''
  }
  return {calls, exec}
}
const noBuild = () => '/fake/duo-hinge'
const clock = () => {
  let t = 0
  return {now: () => t, sleep: (ms: number) => void (t += ms)}
}

test('readFormFactor never asks devicectl about a plain iPhone', () => {
  const {calls, exec} = fakeDevice(PHONE, [])
  assert.equal(readFormFactor('U', exec), 'iphone')
  assert.ok(!calls.some(c => c.includes('displays')))
})

test('readFormFactor reads a Duo posture from devicectl', () => {
  const {exec} = fakeDevice(DUO, [[outer(true), inner(false)]])
  assert.equal(readFormFactor('U', exec), 'duo-folded')
})

test('setPosture refuses a device that does not fold', () => {
  const {exec} = fakeDevice(PHONE, [])
  assert.throws(() => setPosture('U', 'folded', {build: noBuild, exec, ...clock()}), /only the iPhone Duo folds/)
})

test('setPosture sweeps from the current angle and waits for the outer screen', () => {
  const {calls, exec} = fakeDevice(DUO, [[outer(false), inner(true)], [outer(true), inner(false)]])
  setPosture('U', 'folded', {build: noBuild, exec, ...clock()})
  assert.ok(calls.some(c => c.join(' ').endsWith('spawn U /fake/duo-hinge set 180 0')))
})

test('setPosture does nothing to a Duo already in the posture', () => {
  const {calls, exec} = fakeDevice(DUO, [[outer(true), inner(false)]], '0.0')
  setPosture('U', 'folded', {build: noBuild, exec, ...clock()})
  assert.ok(!calls.some(c => c.includes('set')))
})

test('setPosture throws when the screens never switch, naming the fix', () => {
  const {exec} = fakeDevice(DUO, [[outer(false), inner(true)]])
  const c = clock()
  assert.throws(() => setPosture('U', 'folded', {build: noBuild, exec, ...c}), /did not switch screens.*Device Hub.*restart/s)
  assert.ok(c.now() <= 9000)
})

// Appium's screenshot is always the Duo's outer screen (probed 2026-11-17: black when unfolded), so a
// Duo is captured through simctl, naming the lit screen.
test('screenshotDisplayOf is the lit Duo screen, and nothing for a plain iPhone', () => {
  assert.equal(screenshotDisplayOf('U', fakeDevice(DUO, [[outer(true), inner(false)]]).exec), 1)
  assert.equal(screenshotDisplayOf('U', fakeDevice(DUO, [[outer(false), inner(true)]]).exec), 3)
  const phone = fakeDevice(PHONE, [])
  assert.equal(screenshotDisplayOf('U', phone.exec), undefined)
  assert.ok(!phone.calls.some(c => c.includes('displays')))
})

test('simctlScreenshot captures the named display and leaves no file behind', async () => {
  let args: ReadonlyArray<string> = []
  const png = await simctlScreenshot('U', 3, async (_file, a) => {
    args = a
    await fs.promises.writeFile(a.at(-1)!, 'PNGBYTES')
  })
  assert.equal(png.toString(), 'PNGBYTES')
  assert.deepEqual(args.slice(0, 5), ['simctl', 'io', 'U', 'screenshot', '--display=3'])
  assert.ok(!fs.existsSync(args.at(-1)!))
})

test('KB_IOS_SCREEN names the udid and display a Duo run screenshots', () => {
  assert.equal(parseScreenTarget(undefined), undefined)
  assert.equal(parseScreenTarget(''), undefined)
  assert.deepEqual(parseScreenTarget('4E81-AB:3'), {displayId: 3, udid: '4E81-AB'})
  assert.throws(() => parseScreenTarget('4E81-AB'), /KB_IOS_SCREEN/)
})

test('formFactorMismatch names both labels when the device moved during a run', () => {
  assert.equal(formFactorMismatch('iphone', 'iphone'), undefined)
  assert.equal(formFactorMismatch('duo-folded', 'duo-folded'), undefined)
  assert.match(formFactorMismatch('duo-folded', 'duo-unfolded') ?? '', /is iPhone Duo Unfolded but this run is iPhone Duo Folded/)
  // the device can only say unfolded; the split itself is checked through the app's window
  assert.equal(formFactorMismatch('duo-split-left', 'duo-unfolded'), undefined)
  assert.match(formFactorMismatch('duo-split-right', 'duo-folded') ?? '', /is iPhone Duo Folded but this run is iPhone Duo Split Right/)
})

test("touchInner sends interface points on the inner screen to the helper, mapped to the panel's axes", () => {
  const calls: Array<Array<string>> = []
  const exec: Exec = (file, args) => {
    calls.push([file, ...args])
    if (args.includes('list')) return JSON.stringify({devices: {r: [{deviceTypeIdentifier: DUO, udid: 'U'}]}})
    if (args.includes('displays')) {
      return JSON.stringify({
        result: {
          displays: [
            {...outer(false), bounds: [[0, 0], [1398, 2034]], currentOrientation: 'rot0', name: 'LCD', pointScale: 3, uniqueId: 'OUTER'},
            {...inner(true), bounds: [[0, 0], [2007, 2853]], currentOrientation: 'rot90', name: 'LCD-1', pointScale: 3, uniqueId: 'INNER'},
          ],
        },
      })
    }
    return ''
  }
  touchInner('U', [{ms: 0, x: 764, y: 182}, {ms: 1000, x: 764, y: 182}], {build: noBuild, exec})
  assert.deepEqual(calls.at(-1), ['xcrun', 'simctl', 'spawn', 'U', '/fake/duo-hinge', 'touch', 'INNER', '0.2720,0.1966,0', '0.2720,0.1966,1000'])
})

test('touchInner refuses a device that is not a Duo', () => {
  assert.throws(() => touchInner('U', [{ms: 0, x: 1, y: 1}], {build: noBuild, exec: fakeDevice(PHONE, []).exec}), /only an iPhone Duo/)
})

test('restartSimulator shuts down, waits until it is down, boots, waits until devicectl answers, and shows Device Hub', () => {
  const calls: Array<string> = []
  const states = ['Booted', 'Shutting Down', 'Shutdown']
  let displays = 0
  restartSimulator(
    'U',
    (file, args) => {
      calls.push([file, ...args].join(' '))
      if (args.includes('list')) return JSON.stringify({devices: {r: [{state: states.shift() ?? 'Shutdown', udid: 'U'}]}})
      if (args.includes('displays')) {
        if (++displays < 2) throw new Error('not ready')
        return JSON.stringify({result: {displays: []}})
      }
      return ''
    },
    () => {}
  )
  assert.deepEqual(calls, [
    'xcrun simctl list devices -j',
    'xcrun simctl shutdown U',
    'xcrun simctl list devices -j',
    'xcrun simctl list devices -j',
    'xcrun simctl boot U',
    'xcrun simctl bootstatus U -b',
    'xcrun devicectl device info displays -d U -q -j -',
    'xcrun devicectl device info displays -d U -q -j -',
    'open -a /Applications/Xcode.app/Contents/Applications/DeviceHub.app',
  ])
})

// Device Hub boots a device it shows once it has shut down, which can beat our own boot to it
test('restartSimulator carries on when something else booted the simulator first', () => {
  const states = ['Booted', 'Shutdown', 'Booted']
  const calls: Array<string> = []
  restartSimulator(
    'U',
    (file, args) => {
      calls.push([file, ...args].join(' '))
      if (args.includes('list')) return JSON.stringify({devices: {r: [{state: states.shift() ?? 'Booted', udid: 'U'}]}})
      if (args[1] === 'boot') throw new Error('Unable to boot device in current state: Booted')
      if (args.includes('displays')) return JSON.stringify({result: {displays: []}})
      return ''
    },
    () => {}
  )
  assert.ok(calls.includes('xcrun simctl bootstatus U -b'))
})

test('touchInner tries a touch once more when the helper does not answer', () => {
  let touches = 0
  const exec: Exec = (_file, args) => {
    if (args.includes('list')) return JSON.stringify({devices: {r: [{deviceTypeIdentifier: DUO, udid: 'U'}]}})
    if (args.includes('displays')) {
      return JSON.stringify({result: {displays: [{...inner(true), bounds: [[0, 0], [2007, 2853]], currentOrientation: 'rot90', name: 'LCD-1', pointScale: 3, uniqueId: 'INNER'}]}})
    }
    if (args.includes('touch') && ++touches === 1) throw new Error('killed')
    return ''
  }
  touchInner('U', [{ms: 0, x: 1, y: 1}], {build: noBuild, exec})
  assert.equal(touches, 2)
})

test('restartSimulator boots a simulator that is already down without shutting it down', () => {
  const calls: Array<string> = []
  restartSimulator(
    'U',
    (file, args) => {
      calls.push([file, ...args].join(' '))
      return args.includes('list') ? JSON.stringify({devices: {r: [{state: 'Shutdown', udid: 'U'}]}}) : ''
    },
    () => {}
  )
  assert.ok(!calls.includes('xcrun simctl shutdown U'))
  assert.ok(calls.includes('xcrun simctl boot U'))
})

// Seen just after a restart: both screens lit, hinge 0
test('setPosture waits out a just-booted Duo that lights both screens', () => {
  const booting = [outer(true, false), inner(true, false)]
  const {calls, exec} = fakeDevice(DUO, [booting, booting, [outer(false), inner(true)]], '0.0')
  setPosture('U', 'unfolded', {build: noBuild, exec, ...clock()})
  assert.ok(calls.some(c => c.join(' ').endsWith('set 0 180')))
})
