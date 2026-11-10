// Runs part of a flow as another account, or signed out, and always puts the app back on the smoke
// account. Each wrapper checks the app is back on the smoke account before it returns.
import {loadE2EAccounts} from '../../accounts/env'
import * as T from '../../shared/test-ids'
import {el, labeled} from '../helpers/elements'
import {openAccountSwitcher, signedInAs, switchAppAccount, waitSignedIn} from '../helpers/chat'
import {jsEval, waitFor} from '../helpers/lifecycle'
import {escapeToTabs} from '../helpers/navigate'
import {thenRestoring} from '../../shared/restore.ts'
import {relaunchApp} from './device.ts'
import {pressBackToLoginList, tapUntil} from './screens'
import {notSmokeProblem, settledAccount, PHONE_DEVICE_BODY, type PhoneDevice, phoneDeviceProblem} from './app-account-lib.ts'

// signing in from a stored secret takes seconds; the bound covers a slow service
const SIGN_IN_MS = 60_000

export const appAccount = signedInAs

export const requireAppIsSmoke = async () => {
  const problem = notSmokeProblem(await signedInAs(), loadE2EAccounts())
  if (problem) throw new Error(problem)
}

// A relaunch, back on the smoke account. Bound: relaunchApp 200, signed in 90, the account 1 = 291.
export const relaunchOnSmoke = async () => {
  await relaunchApp()
  await waitSignedIn()
  await requireAppIsSmoke()
}

// covers settledAccount's wait for a signed-out answer to hold, and a slow first answer
export const RELAUNCHED_SMOKE_MS = 90_000

// requireAppIsSmoke for an app just launched: a new runtime reports signed out until its service
// answers, so its answer is believed only once settled (app-account-lib.ts settledAccount).
export const requireRelaunchedAppIsSmoke = async () => {
  let firstAnswerAt: number | undefined
  const a = await waitFor(
    'the relaunched app to settle on an account',
    async () => {
      const now = await signedInAs()
      firstAnswerAt ??= Date.now()
      return settledAccount(now, firstAnswerAt, Date.now())
    },
    {interval: 1_000, timeout: RELAUNCHED_SMOKE_MS}
  )
  const problem = notSmokeProblem(a, loadE2EAccounts())
  if (problem) throw new Error(problem)
}

// Runs `f` with the app switched to the second account, through the app's own account switcher,
// then puts the app back on the smoke account whether `f` passed or threw (restoreToSmoke, as `f`
// can leave a switch under way or the app signed out).
export const asSecond = async <R,>(f: () => Promise<R>): Promise<R> =>
  thenRestoring(
    async () => {
      await switchAppAccount(loadE2EAccounts().secondUser)
      return f()
    },
    restoreToSmoke,
    'switching back to the smoke account'
  )

// Signs the app out from the account switcher's "Log in as another user" (the smoke account keeps
// its stored secret, so it stays in the login screen's list), runs `f` on the login screen, then
// signs the smoke account back in whether `f` passed or threw.
export const signedOutThenBack = async <R,>(f: () => Promise<R>): Promise<R> =>
  thenRestoring(
    async () => {
      await openAccountSwitcher()
      // The button is disabled while a login or an account switch is still settling (just after
      // asSecond's restore, say), and a disabled button renders a plain view with the same text: a
      // tap on that text does nothing. Only the enabled button is a Button element.
      const loginAsOther = labeled('Button', 'Log in as another user')
      await loginAsOther.waitForExist({timeout: SIGN_IN_MS, timeoutMsg: 'the switcher\'s "Log in as another user" never became tappable'})
      await loginAsOther.click()
      await el(T.LOGIN_USER_LIST).waitForExist({timeout: SIGN_IN_MS, timeoutMsg: 'the login screen never showed its account list'})
      return f()
    },
    restoreToSmoke,
    'signing the smoke account back in'
  )

// On the login screen, signs `username` in by its row, which signs an account with a stored secret
// in at once (no password), and waits until the app is signed in as it.
export const signInFromStoredSecret = async (username: string) => {
  // the login screen ignores a tap for a moment after a sign-out: tap again until the sign-in starts
  await tapUntil(
    async () => el(T.LOGIN_USER_ROW_PREFIX + username).click().catch(() => {}),
    async () => {
      const now = await signedInAs().catch(() => undefined)
      return !!(now?.loggedIn || now?.switching)
    },
    `the row of ${username} in the login list started no sign-in`
  )
  await waitFor(`${username} to sign in`, async () => {
    const now = await signedInAs().catch(() => undefined)
    return now?.loggedIn && !now.switching && now.username === username ? true : undefined
  }, {interval: 250, timeout: SIGN_IN_MS})
}

// Waits out a switch or sign-in already under way, and returns where it landed.
export const settledAppAccount = async () =>
  waitFor('the app to finish switching', async () => {
    const now = await signedInAs()
    return now.switching ? undefined : now
  }, {interval: 500, timeout: SIGN_IN_MS})

// Back to the smoke account: signed in as another account, through the account switcher; signed
// out, from the login screen by picking the smoke account in its list, which signs in with the
// stored secret (no password). Does nothing when the app is already on the smoke account.
export const restoreToSmoke = async () => {
  const {smokeUser} = loadE2EAccounts()
  const a = await settledAppAccount()
  if (a.loggedIn) {
    if (a.username !== smokeUser) await switchAppAccount(smokeUser)
  } else {
    await pressBackToLoginList()
    await signInFromStoredSecret(smokeUser)
    await escapeToTabs()
  }
  await requireAppIsSmoke()
}

// The phone's own device on the smoke account, read from the app (the host's CLI knows only the
// host's device): what a flow on the phone must never revoke (shared/devices.ts
// requireRevocableFromPhone), and what a peer picks as the device it provisions from.
export const phoneDevice = async (): Promise<{deviceID: string; deviceName: string}> => {
  const {smokeUser} = loadE2EAccounts()
  const d = await jsEval<PhoneDevice>(PHONE_DEVICE_BODY)
  const problem = phoneDeviceProblem(d, smokeUser)
  if (problem) throw new Error(problem)
  return {deviceID: d.deviceID, deviceName: d.deviceName}
}

export const phoneDeviceId = async (): Promise<string> => (await phoneDevice()).deviceID

// The smoke account's uid as the app holds it (what a push for this account carries). A store read,
// no RPC.
export const appUid = async (): Promise<string> => {
  await requireAppIsSmoke()
  const uid = await jsEval<string | null>(`return kbModule('stores/current-user.tsx').useCurrentUserState.getState().uid || null`)
  if (!uid || !/^[0-9a-f]{32}$/.test(uid)) throw new Error('the app holds no uid for the smoke account')
  return uid
}
