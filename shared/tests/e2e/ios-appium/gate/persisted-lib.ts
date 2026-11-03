// Parts of the iOS settings flows: what a settings control's testID says it shows (and the one read
// of it off the screen, settingShown, the only part that drives the app).
import {SETTING_OFF, SETTING_ON, SETTING_PENDING} from '../../shared/test-ids'

export type SettingShown = 'on' | 'off' | 'pending'

// the testIDs a settings switch or radio with base `base` can carry
export const settingIDs = (base: string) => [`${base}${SETTING_ON}`, `${base}${SETTING_OFF}`, `${base}${SETTING_PENDING}`]

// What the control whose testID is `id` shows, or undefined when `id` is not one of `base`'s.
export const settingShownOf = (id: string, base: string): SettingShown | undefined => {
  switch (id) {
    case `${base}${SETTING_ON}`:
      return 'on'
    case `${base}${SETTING_OFF}`:
      return 'off'
    case `${base}${SETTING_PENDING}`:
      return 'pending'
    default:
      return undefined
  }
}

// The selector of every state of the control with testID base `base`.
export const settingSelector = (base: string) => `-ios predicate string:name IN {${settingIDs(base).map(id => `"${id}"`).join(', ')}}`

// What the control with testID base `base` shows on screen, or undefined while it is not drawn. A
// control swaps its testID as it changes state (pending, then on or off), so the element found can be
// gone by the time its name is read: that reads as not drawn now, for the caller's wait to read
// again. Two states drawn at once throw. Bound: one read 1.
export const settingShown = async (base: string): Promise<SettingShown | undefined> => {
  const found = await browser.$$(settingSelector(base)).getElements()
  if (found.length > 1) throw new Error(`${found.length} of one control's states drawn, not one`)
  const id = found[0] ? await found[0].getAttribute('name').catch(() => null) : null
  return id ? settingShownOf(id, base) : undefined
}
