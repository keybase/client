import {SETTINGS_LOCKDOWN_SWITCH, settingTestID} from '../../shared/test-ids'
import {isVdebugLevel, proxySaveWrites, rectsOverlap, settingIDs, settingShownOf, vdebugDetailed, vdebugLevels} from './persisted-lib'

test("a control's testID reads back as what it shows, and another control's as nothing", () => {
  const base = SETTINGS_LOCKDOWN_SWITCH
  expect(settingShownOf(settingTestID(base, true), base)).toBe('on')
  expect(settingShownOf(settingTestID(base, false), base)).toBe('off')
  // pending wins over what it shows
  expect(settingShownOf(settingTestID(base, true, true), base)).toBe('pending')
  expect(settingShownOf(settingTestID(`${base}-x`, true), base)).toBeUndefined()
  expect(settingShownOf(base, base)).toBeUndefined()
  expect(settingIDs(base).map(id => settingShownOf(id, base))).toEqual(['on', 'off', 'pending'])
})

test('Save writes back the loaded proxy settings, with the form default port when the address had none', () => {
  const none = {addressWithPort: '', certPinning: true, proxyType: 0}
  expect(proxySaveWrites(none)).toEqual({...none, addressWithPort: ':8080'})
  expect(proxySaveWrites({...none, addressWithPort: '127.0.0.1:3128'})).toEqual({...none, addressWithPort: '127.0.0.1:3128'})
  // an address with no port loads as no address
  expect(proxySaveWrites({...none, addressWithPort: 'proxy.local'})).toEqual({...none, addressWithPort: ':8080'})
  expect(proxySaveWrites({addressWithPort: '[::1]:8080', certPinning: false, proxyType: 2})).toEqual({
    addressWithPort: '[::1]:8080',
    certPinning: false,
    proxyType: 2,
  })
})

test("the debug levels are read off KBFS's own service log lines that set one, in order, and nothing else", () => {
  const lines = [
    '2026-10-31T10:00:00.000000Z ▶ [DEBU kbfs(CR) vdebug.go:111] 1a Setting Vdebug to "vlog2"',
    '2026-10-31T10:00:01.000000Z ▶ [DEBU keybase 2] some other line with "vlog9"',
    // the service's own VDebugLog
    '2026-10-31T10:00:01.500000Z ▶ [DEBU keybase vdebug.go:111] 1b Setting Vdebug to "vlog3"',
    '2026-10-31T10:00:02.000000Z ▶ [DEBU kbfs(ECQU - BDL) vdebug.go:111] 1c Setting Vdebug to "vlog1,dump-payload"',
    '2026-10-31T10:00:03.000000Z ▶ [DEBU kbfs vdebug.go:111] 1d Setting Vdebug to "mobile"',
    '2026-10-31T10:00:04.000000Z ▶ [DEBU kbfsx vdebug.go:111] 1e Setting Vdebug to "vlog3"',
    '2026-10-31T10:00:05.000000Z ▶ [DEBU keybase 3] said kbfs(x) Setting Vdebug to "vlog3"',
  ]
  expect(vdebugLevels(lines)).toEqual(['vlog2', 'vlog1,dump-payload', 'mobile'])
  expect(vdebugLevels([])).toEqual([])
})

test("a debug level is VDebugLog's: empty, or a bounded comma list of its directives", () => {
  for (const ok of ['', 'mobile', 'vlog0', 'vlog1,dump-payload', 'vlog3,dump-site-load-user,dump-payload']) expect(isVdebugLevel(ok)).toBe(true)
  for (const bad of ['vlog9', 'vlog1,', ',vlog1', 'vlog1, dump-payload', 'v 1', 'vlog1`', '"vlog1"', Array(30).fill('vlog1').join(',')]) {
    expect(isVdebugLevel(bad)).toBe(false)
  }
  expect(vdebugDetailed('vlog2')).toBe(true)
  expect(vdebugDetailed('dump-payload,vlog2')).toBe(true)
  expect(vdebugDetailed('vlog1,dump-payload')).toBe(false)
})

test('rects overlap only when they share area', () => {
  const line = {height: 20, width: 300, x: 20, y: 100}
  expect(rectsOverlap(line, {height: 44, width: 200, x: 60, y: 110})).toBe(true)
  expect(rectsOverlap(line, {height: 44, width: 200, x: 60, y: 120})).toBe(false)
  expect(rectsOverlap(line, {height: 44, width: 200, x: 60, y: 140})).toBe(false)
  expect(rectsOverlap(line, {height: 10, width: 10, x: 320, y: 105})).toBe(false)
})
