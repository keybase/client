/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers top-level tests; they are not awaited */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'fs'
import {
  classifyFormFactor,
  formFactorLabel,
  formFactorMismatch,
  formFactorStoreKey,
  parsePosture,
  parseScreenTarget,
  readFormFactor,
  screenshotDisplayOf,
  setPosture,
  simctlScreenshot,
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
  assert.equal(formFactorLabel('ipad'), 'ipad')
  assert.equal(formFactorStoreKey('iphone'), 'ios')
  assert.equal(formFactorStoreKey('duo-folded'), 'ios-duo-folded')
  assert.equal(formFactorStoreKey('duo-unfolded'), 'ios-duo-unfolded')
})

test('parsePosture takes folded, unfolded or nothing', () => {
  assert.equal(parsePosture(undefined), undefined)
  assert.equal(parsePosture(''), undefined)
  assert.equal(parsePosture('folded'), 'folded')
  assert.equal(parsePosture('unfolded'), 'unfolded')
  assert.throws(() => parsePosture('half'), /folded or unfolded/)
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
