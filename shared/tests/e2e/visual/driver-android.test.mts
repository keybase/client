/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers top-level tests; they are not awaited */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {makePng, pngBuffer} from './compare.mts'
import {
  ANIMATION_SCALES,
  appAreaBlank,
  androidCleanupCommands,
  androidFormFactor,
  androidRestoreSteps,
  centrePx,
  DEMO_COMMANDS,
  friendlyDeviceName,
  judgeProtectedShot,
  parseAdbDevices,
  parseNightMode,
  parseWm,
  visibleCentre,
} from './driver-android.mts'

test('adb devices lists only the ready serials', () => {
  const out = 'List of devices attached\nemulator-5554\tdevice\nemulator-5556\toffline\nR58M\tunauthorized\nemulator-5558\tdevice\n'
  assert.deepEqual(parseAdbDevices(out), ['emulator-5554', 'emulator-5558'])
  assert.deepEqual(parseAdbDevices('List of devices attached\n\n'), [])
})

test('the inspector name is the one React Native gives Metro', () => {
  assert.equal(friendlyDeviceName('sdk_gphone64_arm64', '12', '32'), 'sdk_gphone64_arm64 - 12 - API 32')
})

test('wm size and density take the override over the physical value', () => {
  assert.equal(parseWm('Physical size: 1080x2400', 'size'), '1080x2400')
  assert.equal(parseWm('Physical size: 1080x2400\nOverride size: 720x1600', 'size'), '720x1600')
  assert.equal(parseWm('Physical density: 420', 'density'), '420')
  assert.throws(() => parseWm('nothing', 'density'), /no density/)
})

test('a screen 600dp or more on its short side is a tablet, in either orientation', () => {
  assert.equal(androidFormFactor('1080x2400', '420'), 'phone')
  assert.equal(androidFormFactor('2560x1600', '320'), 'tablet')
  assert.equal(androidFormFactor('1600x2560', '320'), 'tablet')
  assert.throws(() => androidFormFactor('wide', '320'), /cannot read the screen/)
})

test('the status bar is pinned to 9:41 with full bars and battery, and no notification icons', () => {
  assert.deepEqual(DEMO_COMMANDS[0], ['enter'])
  assert.deepEqual(DEMO_COMMANDS[1], ['clock', '-e', 'hhmm', '0941'])
  assert.ok(DEMO_COMMANDS.some(c => c[0] === 'notifications' && c.includes('false')))
  assert.deepEqual(ANIMATION_SCALES, ['animator_duration_scale', 'transition_animation_scale', 'window_animation_scale'])
})

test('restore puts back what prepare found, deleting settings that were unset', () => {
  const original = {
    demoAllowed: 'null',
    night: 'auto',
    scales: [
      {key: 'animator_duration_scale', value: '1.0'},
      {key: 'transition_animation_scale', value: 'null'},
    ],
  }
  assert.deepEqual(androidRestoreSteps(original), [
    ['shell', 'am', 'broadcast', '-a', 'com.android.systemui.demo', '-e', 'command', 'exit'],
    ['shell', 'settings', 'delete', 'global', 'sysui_demo_allowed'],
    ['shell', 'cmd', 'uimode', 'night', 'auto'],
    ['shell', 'settings', 'put', 'global', 'animator_duration_scale', '1.0'],
    ['shell', 'settings', 'delete', 'global', 'transition_animation_scale'],
  ])
  // a night mode it cannot set back (custom) is left alone
  assert.ok(!androidRestoreSteps({...original, night: 'custom'}).some(s => s.includes('uimode')))
})

test('cleanup commands name the device, end with a relaunch, and are empty before prepare', () => {
  assert.deepEqual(androidCleanupCommands('emulator-5554', undefined), [])
  const cmds = androidCleanupCommands('emulator-5554', {demoAllowed: '0', night: 'no', scales: []})
  assert.ok(cmds.every(c => c.startsWith('adb -s emulator-5554 ')))
  assert.match(cmds.at(-1) ?? '', /am start .* -n io\.keybase\.ossifrage\/\.MainActivity/)
  assert.ok(cmds.some(c => c.includes('am force-stop io.keybase.ossifrage')))
})

test('night mode reads the mode cmd uimode prints', () => {
  assert.equal(parseNightMode('Night mode: no'), 'no')
  assert.equal(parseNightMode('Night mode: auto\n'), 'auto')
})

test('a view centre in window points becomes screen pixels', () => {
  assert.deepEqual(centrePx({bottom: 120, left: 10, right: 50, top: 100}, 2.625), {x: 79, y: 289})
})

test('the app area is blank only when all of its middle is black; the system bars may draw', () => {
  const png = makePng(10, 100)
  for (let i = 0; i < png.data.length; i += 4) png.data.set([0, 0, 0, 255], i)
  // the status bar and navigation bar the system still draws over a secure window
  for (const y of [2, 95]) png.data.set([255, 255, 255, 255], (y * 10 + 5) * 4)
  assert.equal(appAreaBlank(png), true)
  png.data.set([200, 200, 200, 255], (50 * 10 + 5) * 4)
  assert.equal(appAreaBlank(png), false)
})

test('a protected shot passes when the device draws it black or refuses it, and fails when the app shows', () => {
  const black = makePng(10, 100)
  for (let i = 0; i < black.data.length; i += 4) black.data.set([0, 0, 0, 255], i)
  assert.equal(judgeProtectedShot(pngBuffer(black)).kind, 'blank')
  assert.deepEqual(judgeProtectedShot(Buffer.alloc(0)), {kind: 'refused'})
  black.data.set([255, 255, 255, 255], (50 * 10 + 5) * 4)
  assert.deepEqual(judgeProtectedShot(pngBuffer(black)), {kind: 'shows'})
})

test('a tap goes to the centre of the part of a view in the window, and nowhere when none is', () => {
  const win = {height: 800, width: 400}
  assert.deepEqual(visibleCentre({bottom: 840, left: 0, right: 100, top: 760}, win), {bottom: 800, left: 0, right: 100, top: 760})
  assert.equal(visibleCentre({bottom: 900, left: 0, right: 100, top: 820}, win), undefined)
})
