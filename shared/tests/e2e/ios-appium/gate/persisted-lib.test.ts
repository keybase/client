import {TEAMS_SETTINGS_FEATURE, settingTestID} from '../../shared/test-ids'
import {settingIDs, settingShownOf} from './persisted-lib'

test("a control's testID reads back as what it shows, and another control's as nothing", () => {
  const base = TEAMS_SETTINGS_FEATURE
  expect(settingShownOf(settingTestID(base, true), base)).toBe('on')
  expect(settingShownOf(settingTestID(base, false), base)).toBe('off')
  // pending wins over what it shows
  expect(settingShownOf(settingTestID(base, true, true), base)).toBe('pending')
  expect(settingShownOf(settingTestID(`${base}-x`, true), base)).toBeUndefined()
  expect(settingShownOf(base, base)).toBeUndefined()
  expect(settingIDs(base).map(id => settingShownOf(id, base))).toEqual(['on', 'off', 'pending'])
})
