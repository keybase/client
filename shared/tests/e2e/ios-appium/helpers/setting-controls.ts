// The settings pages' switches and radios, read off their testIDs (test-ids.ts SETTING_*: what each
// shows, or that it is still loading or saving, since the control alone has no state in the tree),
// tapped with the one call each sends checked in the recorder's log.
import {same} from '../../shared/settings'
import * as T from '../../shared/test-ids'
import {settingSelector, settingShown} from '../gate/persisted-lib.ts'
import {currentCallSeq, uiCallsSince, waitForUiCall} from '../gate/recorder'
import type {CallMark} from '../gate/recorder-lib'
import {dragUntilOnScreen} from './chat'
import {el} from './elements'
import {waitFor} from './lifecycle'
import {check} from './menus'
import {openSettingsPage} from './settings'

export type Shown = {base: string; want: 'on' | 'off'}

export const radioOf = (prefix: string, v: string): Shown => ({base: `${prefix}${v}`, want: 'on'})
export const switchOf = (base: string, on: boolean): Shown => ({base, want: on ? 'on' : 'off'})

// Scrolls the control on screen, once the page draws it. A page opened right after a relaunch draws
// a group only once its settings load, and a drag before that scrolls past where it comes (seen live:
// the chat page ended at its bottom with the notification group at its top). Bound: 10s for it to be
// drawn, 10s of drags = 20.
const dragToControl = async (base: string, what: string) => {
  await browser.$(settingSelector(base)).waitForExist({timeout: 10_000})
  await dragUntilOnScreen(what, () => browser.$(settingSelector(base)), 10_000)
}

// Scrolls the control on screen and waits for it to show `want` (not pending). Bound: the drag 20,
// 20s of reads, overrun by one 1 = 41.
export const expectShown = async ({base, want}: Shown, what: string) => {
  await dragToControl(base, what)
  await waitFor(`${what} to show ${want}`, async () => ((await settingShown(base)) === want ? true : undefined), {
    interval: 250,
    timeout: 20_000,
  })
}

// Taps the control. Bound: the drag 20, its tap 1 = 21.
export const tapControl = async (base: string, what: string) => {
  await dragToControl(base, what)
  await browser.$(settingSelector(base)).click()
}

// Waits for one call of `method` since `seq`, and no second. Bound: waitForUiCall 12, the count 2 = 14.
export const calledOnce = async (seq: CallMark, method: string, what: string) => {
  await waitForUiCall(`${what} to go out`, seq, method)
  const n = (await uiCallsSince(seq, method)).length
  check(n === 1, `${what} went out ${n} times, not once`)
}

// Taps the control and waits for its one call. Bound: seq 2, tapControl 21, calledOnce 14 = 37.
export const tapAndCall = async (base: string, method: string, what: string) => {
  const seq = await currentCallSeq()
  await tapControl(base, what)
  await calledOnce(seq, method, what)
}

// Taps the Save `saveID` and waits for its one call. Bound: seq 2, the drag 20, its tap 1, calledOnce
// 14 = 37.
export const saveAndCall = async (saveID: string, method: string, what: string) => {
  const seq = await currentCallSeq()
  await dragUntilOnScreen(`${what}'s Save`, () => el(saveID))
  await el(saveID).click()
  await calledOnce(seq, method, what)
}

// Waits for `read` to answer `want`. Bound: 30s of reads, overrun by one: a host read 150 (180 in
// all), a phone ask 22 (52).
export const settles = async <V,>(what: string, read: () => Promise<V>, want: V) =>
  waitFor(what, async () => (same(await read(), want) ? true : undefined), {interval: 1_000, timeout: 30_000})

// Bound: openSettingsPage 97.
export const openNotificationSettings = async () =>
  openSettingsPage('Notifications', 'settingsTabs.notificationsTab', T.SETTINGS_NOTIFICATIONS)
