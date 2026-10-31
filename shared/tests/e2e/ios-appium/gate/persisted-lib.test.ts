import {SETTINGS_LOCKDOWN_SWITCH, settingTestID} from '../../shared/test-ids'
import {proxySaveWrites, settingIDs, settingShownOf, vdebugLevels} from './persisted-lib'

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

test('the debug levels are read off the service log lines that set one, in order, and nothing else', () => {
  const lines = [
    '2026-10-31T10:00:00.000000Z ▶ [DEBU kbfs(CR) 1] Setting Vdebug to "vlog2"',
    '2026-10-31T10:00:01.000000Z ▶ [DEBU keybase 2] some other line with "vlog9"',
    '2026-10-31T10:00:02.000000Z ▶ [DEBU kbfs(MDJ) 3] Setting Vdebug to "vlog0"',
  ]
  expect(vdebugLevels(lines)).toEqual(['vlog2', 'vlog0'])
  expect(vdebugLevels([])).toEqual([])
})
