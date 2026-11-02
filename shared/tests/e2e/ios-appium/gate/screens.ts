// The screen the app shows, by its route name and params as the app's router reads them, and taps
// that wait for a screen by name.
import type {ChainablePromiseElement} from 'webdriverio'
import * as T from '../../shared/test-ids'
import {el} from '../helpers/elements'
import {appSnapshot, waitFor} from '../helpers/lifecycle'

const TAPS = 5

// The back affordance of the screen on top: the custom BackButton (testID backButton), or a native
// bar's Back item, which takes no testID: a screen's default back, and the flow-aware back iOS
// recover-password screens put in their bar.
const NATIVE_BACK = '-ios class chain:**/XCUIElementTypeNavigationBar/**/XCUIElementTypeButton[`label == "Back" OR name == "BackButton"`]'

export const tapBack = async () => {
  for (const back of [el('backButton'), browser.$(NATIVE_BACK)]) {
    if (await back.isExisting()) {
      await back.click().catch(() => {})
      return true
    }
  }
  return false
}

// The screen the app shows. Bound: one read 1.
export const visibleScreen = async () => (await appSnapshot()).screen

// Waits for the screen up to be `name` with params `ok` takes, and returns it. Bound: `timeout`, plus
// one read 1.
export const expectScreen = async (
  what: string,
  name: string,
  ok: (params: Record<string, unknown>) => boolean = () => true,
  timeout = 10_000
) =>
  waitFor(
    what,
    async () => {
      const s = await visibleScreen()
      return s?.name === name && ok(s.params ?? {}) ? s : undefined
    },
    {interval: 250, timeout}
  )

export const screenName = async () => (await visibleScreen())?.name

// Waits until the app shows the screen `name` and returns its params.
export const waitForScreen = async (name: string, timeout = 20_000) =>
  waitFor(
    `the ${name} screen`,
    async () => {
      const s = await visibleScreen()
      return s?.name === name ? (s.params ?? {}) : undefined
    },
    {interval: 500, timeout}
  )

const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// `tap` until `shown`, waiting `perTapMs` after each tap before the next: the login screen and the
// switcher ignore a tap for a moment after a sign-out or while sliding in. `failure` says what never
// happened.
export const tapUntil = async (tap: () => Promise<unknown>, shown: () => Promise<boolean>, failure: string, perTapMs = 5_000) => {
  for (let i = 0; i < TAPS; i++) {
    await tap()
    for (const end = Date.now() + perTapMs; Date.now() < end; await sleep(500)) {
      if (await shown()) return
    }
  }
  throw new Error(`${failure} after ${TAPS} tries; the app shows ${(await screenName()) ?? 'no screen'}`)
}

// Swipes the screen up until `target` is in the tree (iOS leaves rows scrolled out of it), at most
// `max` swipes.
export const swipeUpUntil = async (target: () => ChainablePromiseElement, what: string, max = 30) => {
  for (let i = 0; i < max; i++) {
    if (await target().isExisting()) return
    await browser.execute('mobile: swipe', {direction: 'up'})
  }
  if (!(await target().isExisting())) throw new Error(`${what} never scrolled into view after ${max} swipes`)
}

const isScreen = (name: string) => async () => (await screenName()) === name

// Taps `target` until the app shows the screen `name`: the login screen ignores a tap while it is
// still settling after the sign-out, so a tap that opened nothing is tried again.
export const tapToScreen = async (target: () => ChainablePromiseElement, name: string) =>
  tapUntil(async () => target().click(), isScreen(name), `the ${name} screen never showed`)

// The screen's back affordance (the custom BackButton or the native bar's Back item) until `shown`.
// A recover-password back restarts the recovery, a service round trip, so each back waits long
// enough that a second one never lands on the screen the first was going to.
const backUntil = async (shown: () => Promise<boolean>, what: string) =>
  // a screen still sliding in shows no back for a moment: that try then only waits
  tapUntil(tapBack, shown, `${what} never showed`, 20_000)

export const backToScreen = async (name: string) => backUntil(isScreen(name), `the ${name} screen`)

// Back, until the login screen's account list shows: from signed out, out of any screen pushed over
// it. Each back waits long enough for a recover-password back's service round trip.
export const pressBackToLoginList = async () =>
  backUntil(async () => el(T.LOGIN_USER_LIST).isExisting(), 'the login screen with its account list')
