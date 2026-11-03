// Runs part of a flow as another account, or signed out, and always puts the app back on the smoke
// account. Each wrapper checks the app is back on the smoke account before it returns.
import {loadE2EAccounts} from '../../accounts/env'
import * as T from '../../shared/test-ids'
import {byText, el} from '../helpers/elements'
import {openAccountSwitcher, signedInAs, switchAppAccount} from '../helpers/chat'
import {waitFor} from '../helpers/lifecycle'
import {escapeToTabs} from '../helpers/navigate'
import {thenRestoring} from '../../shared/restore.ts'
import {notSmokeProblem, settledAccount} from './app-account-lib.ts'

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
    // a signed-out flow that failed part way leaves a screen pushed over the login screen
    for (let i = 0; i < 6 && !(await list.isExisting()); i++) {
      const back = el('backButton')
      if (!(await back.isExisting())) break
      await back.click().catch(() => {})
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    await list.waitForExist({timeout: SIGN_IN_MS, timeoutMsg: 'the login screen to show its account list (restoreToSmoke starts from it)'})
    await el(T.LOGIN_USER_ROW_PREFIX + smokeUser).click()
    await waitFor('the smoke account to sign in', async () => {
      const now = await signedInAs().catch(() => undefined)
      return now?.loggedIn && !now.switching && now.username === smokeUser ? true : undefined
    }, {interval: 1_000, timeout: SIGN_IN_MS})
    await escapeToTabs()
  }
  await requireAppIsSmoke()
}
