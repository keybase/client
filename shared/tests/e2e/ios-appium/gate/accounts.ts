// Runs part of a flow as another account, or signed out, and always puts the app back on the smoke
// account. Each wrapper checks the app is back on the smoke account before it returns.
import {type E2EEnv, loadE2EAccounts} from '../../accounts/env'
import {requireRevocable} from '../../shared/devices.ts'
import * as T from '../../shared/test-ids'
import {byText, el} from '../helpers/elements'
import {jsEval, openAccountSwitcher, signedInAs, switchAppAccount} from '../helpers/chat'
import {waitFor} from '../helpers/lifecycle'
import {escapeToTabs} from '../helpers/navigate'
import {backOutUntil, thenRestoring} from '../../shared/restore.ts'
import {notSmokeProblem, settledAccount, PHONE_DEVICE_BODY, type PhoneDevice, phoneDeviceProblem} from './app-account-lib.ts'

// signing in from a stored secret takes seconds; the bound covers a slow service
const SIGN_IN_MS = 60_000

export const appAccount = signedInAs

export const requireAppIsSmoke = async () => {
  const problem = notSmokeProblem(await signedInAs(), loadE2EAccounts())
  if (problem) throw new Error(problem)
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
      await byText('Log in as another user').click()
      await el(T.LOGIN_USER_LIST).waitForExist({timeout: SIGN_IN_MS, timeoutMsg: 'the login screen never showed its account list'})
      return f()
    },
    restoreToSmoke,
    'signing the smoke account back in'
  )

// The back affordance of the screen on top: the custom BackButton (testID backButton), or a native
// bar's Back item, which takes no testID: a screen's default back, and the flow-aware back iOS
// recover-password screens put in their bar.
const NATIVE_BACK = '-ios class chain:**/XCUIElementTypeNavigationBar/**/XCUIElementTypeButton[`label == "Back" OR name == "BackButton"`]'

const tapBack = async () => {
  for (const back of [el('backButton'), browser.$(NATIVE_BACK)]) {
    if (await back.isExisting()) {
      await back.click().catch(() => {})
      return true
    }
  }
  return false
}

// a signed-out flow that failed part way leaves at most a few screens over the login screen
const MAX_BACKS = 8

// Back to the smoke account: signed in as another account, through the account switcher; signed
// out, from the login screen (backing out of any screen pushed over it) by picking the smoke
// account in its list, which signs in with the stored secret (no password). Does nothing when the
// app is already on the smoke account.
export const restoreToSmoke = async () => {
  const {smokeUser} = loadE2EAccounts()
  // a switch or sign-in already under way lands first
  const a = await waitFor('the app to finish switching', async () => {
    const now = await signedInAs()
    return now.switching ? undefined : now
  }, {interval: 500, timeout: SIGN_IN_MS})
  if (a.loggedIn) {
    if (a.username !== smokeUser) await switchAppAccount(smokeUser)
  } else {
    const list = el(T.LOGIN_USER_LIST)
    await backOutUntil(
      {atTarget: async () => list.isExisting(), tapBack, what: 'the login screen with its account list (restoreToSmoke starts from it)'},
      {maxTaps: MAX_BACKS, pause: async () => new Promise(resolve => setTimeout(resolve, 500)), timeoutMs: SIGN_IN_MS}
    )
    await el(T.LOGIN_USER_ROW_PREFIX + smokeUser).click()
    await waitFor('the smoke account to sign in', async () => {
      const now = await signedInAs().catch(() => undefined)
      return now?.loggedIn && !now.switching && now.username === smokeUser ? true : undefined
    }, {interval: 1_000, timeout: SIGN_IN_MS})
    await escapeToTabs()
  }
  await requireAppIsSmoke()
}

// The phone's own device on the smoke account, read from the app (the host's CLI knows only the
// host's device): what a flow on the phone must never revoke, and what a peer picks as the device
// it provisions from.
export const phoneDevice = async (): Promise<{deviceID: string; deviceName: string}> => {
  const {smokeUser} = loadE2EAccounts()
  const d = await jsEval<PhoneDevice>(PHONE_DEVICE_BODY)
  const problem = phoneDeviceProblem(d, smokeUser)
  if (problem) throw new Error(problem)
  return {deviceID: d.deviceID, deviceName: d.deviceName}
}

export const phoneDeviceId = async (): Promise<string> => (await phoneDevice()).deviceID

// requireRevocable for a flow on the phone: the phone's own device is refused too.
export const requireRevocableFromPhone = async (env: E2EEnv, expected: {deviceID: string; name: string}) =>
  requireRevocable(env, expected, {phoneDeviceID: await phoneDeviceId()})
