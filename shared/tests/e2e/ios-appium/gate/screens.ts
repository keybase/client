// The screen the app shows, by its route name and params as the app's router reads them, and taps
// that wait for a screen by name.
import type {ChainablePromiseElement} from 'webdriverio'
import * as T from '../../shared/test-ids'
import {el} from '../helpers/elements'
import {appSnapshot, waitFor} from '../helpers/lifecycle'
import {tapBack} from './accounts'

const TAPS = 5

export const visibleScreen = async () => (await appSnapshot()).screen

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

// Back, until the login screen's account list shows.
export const pressBackToLoginList = async () =>
  backUntil(async () => el(T.LOGIN_USER_LIST).isExisting(), 'the login screen with its account list')
