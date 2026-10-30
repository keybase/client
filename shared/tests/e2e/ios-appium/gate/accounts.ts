// Runs part of a flow as another account, or signed out, and always puts the app back on the smoke
// account. Each wrapper checks the app is back on the smoke account before it returns.
import {loadE2EAccounts} from '../../accounts/env'
import * as T from '../../shared/test-ids'
import {byText, el} from '../helpers/elements'
import {openAccountSwitcher, signedInAs, switchAppAccount} from '../helpers/chat'
import {waitFor} from '../helpers/lifecycle'
import {escapeToTabs} from '../helpers/navigate'

// signing in from a stored secret takes seconds; the bound covers a slow service
const SIGN_IN_MS = 60_000

export const appAccount = signedInAs

export const requireAppIsSmoke = async () => {
  const {smokeUser} = loadE2EAccounts()
  const a = await signedInAs()
  if (!a.loggedIn || a.username !== smokeUser) {
    throw new Error(`the simulator app is signed in as ${a.loggedIn ? a.username : '(nobody; signed out)'}, not the e2e smoke account; refusing to run`)
  }
}

// Runs `f` with the app switched to the second account, through the app's own account switcher,
// then switches back to the smoke account whether `f` passed or threw.
export const asSecond = async <R,>(f: () => Promise<R>): Promise<R> => {
  const {secondUser, smokeUser} = loadE2EAccounts()
  let result: R
  try {
    await switchAppAccount(secondUser)
    result = await f()
  } catch (e) {
    // a failed switch back keeps the first error too
    try {
      await switchAppAccount(smokeUser)
    } catch (r) {
      throw new AggregateError([e, r], `${String(e)}; and then switching back to the smoke account failed: ${String(r)}`, {cause: r})
    }
    await requireAppIsSmoke()
    throw e
  }
  await switchAppAccount(smokeUser)
  await requireAppIsSmoke()
  return result
}

// Signs the app out from the account switcher's "Log in as another user" (the smoke account keeps
// its stored secret, so it stays in the login screen's list), runs `f` on the login screen, then
// signs the smoke account back in whether `f` passed or threw.
export const signedOutThenBack = async <R,>(f: () => Promise<R>): Promise<R> => {
  try {
    await openAccountSwitcher()
    await byText('Log in as another user').click()
    await el(T.LOGIN_USER_LIST).waitForExist({timeout: SIGN_IN_MS, timeoutMsg: 'the login screen never showed its account list'})
    return await f()
  } finally {
    await restoreToSmoke()
  }
}

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
