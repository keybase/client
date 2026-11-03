// Parts of the iOS settings flows: what a settings control's testID says it shows (and the one read
// of it off the screen, settingShown, the only part that drives the app), what "Save Proxy Settings"
// writes back for the settings it loaded, and the KBFS debug levels the phone's service log records.
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

export type ProxySettings = {addressWithPort: string; certPinning: boolean; proxyType: number}

// What Save writes for the settings the form loaded (settings/proxy.tsx): the form splits the address
// at its last ':' and writes `address:port` back, with the port 8080 when the address had none (an
// address with no ':' loads as no address at all), and the same type and pinning.
export const proxySaveWrites = (loaded: ProxySettings): ProxySettings => {
  const parts = loaded.addressWithPort.split(':')
  const address = parts.slice(0, -1).join(':')
  const port = parts.length >= 2 ? (parts.at(-1) ?? '') : '8080'
  return {addressWithPort: `${address}:${port}`, certPinning: loaded.certPinning, proxyType: loaded.proxyType}
}

// The KBFS debug levels set, in order, in `lines` of the phone's service log (libkb's VDebugLog logs
// each one it is configured with). Only KBFS's own loggers' lines count (`kbfs`, `kbfs(<module>)`):
// the service's own VDebugLog (`keybase`) logs the same line for its level, which the KBFS level
// does not change. Only the level of each such line is kept.
const kbfsVdebugRe = /▶ \[DEBU kbfs(?:\([^)]*\))? [^\]]*\].*?\bSetting Vdebug to "([^"]*)"/
export const vdebugLevels = (lines: ReadonlyArray<string>) =>
  lines.flatMap(l => {
    const m = kbfsVdebugRe.exec(l)
    return m ? [m[1] ?? ''] : []
  })

// libkb's VDebugLog directives (libkb/vdebug.go Configure), which a level lists separated by commas.
const VDEBUG_TOKENS: ReadonlySet<string> = new Set(['mobile', 'vlog0', 'vlog1', 'vlog2', 'vlog3', 'dump-site-load-user', 'dump-payload'])
// a level of every directive at most twice over
const VDEBUG_MAX = 128

// Whether `level` is one VDebugLog takes: empty (its default), or a comma list of its directives,
// bounded in length.
export const isVdebugLevel = (level: string) =>
  level === '' || (level.length <= VDEBUG_MAX && level.split(',').every(t => VDEBUG_TOKENS.has(t)))

// Whether `level` turns detailed logging (vlog2) on.
export const vdebugDetailed = (level: string) => level.split(',').includes('vlog2')

export type Rect = {height: number; width: number; x: number; y: number}

// Whether two drawn rects share any area (rects that only touch do not).
export const rectsOverlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
