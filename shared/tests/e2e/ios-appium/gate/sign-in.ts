// The phone's login screen and stored secrets: what its service keeps for an account, what the login
// screen would sign in, and a password sign-in through the login screen's own field. The password
// goes in only through submitSecret, and nothing here takes a screenshot or reads a page source
// while the field holds it. Every message is built from usernames, states and the app's error text.
import {loadE2EAccounts} from '../../accounts/env'
import * as T from '../../shared/test-ids'
import {openAccountSwitcher} from '../helpers/chat'
import {byText, el, labeled} from '../helpers/elements'
import {jsEval, waitFor} from '../helpers/lifecycle'
import {appAccount, settledAppAccount} from './accounts'
import {
  answerTo,
  CONFIGURED_ACCOUNTS_READ_BODY,
  type ConfiguredAccounts,
  configuredAccountsAskBody,
  LOGIN_SCREEN_BODY,
  type LoginScreen,
  passwordScreenProblem,
  storedSecretIn,
} from './app-account-lib.ts'
import {withHarnessRpcs} from './recorder'
import {pressBackToLoginList, tapUntil} from './screens'
import {emptySecretField, focusSecretField, submitSecret} from './secret-input'
import {clearSecretOnScreen, markSecretOnScreen} from './secret-screen.ts'

const SIGN_IN_MS = 60_000
let asks = 0

// Whether the phone's service keeps a stored secret for `username`, as it answers now.
export const storedSecretOf = async (username: string): Promise<boolean> => {
  // unique across runs too: the app's global outlives this process
  const ask = `${Date.now()}-${++asks}`
  const r = await withHarnessRpcs('the configured-accounts ask', async () => {
    await jsEval(configuredAccountsAskBody(ask))
    return waitFor(
      "the phone's service to list its configured accounts",
      async () => answerTo(await jsEval<ConfiguredAccounts>(CONFIGURED_ACCOUNTS_READ_BODY), ask),
      {interval: 250, timeout: 20_000}
    )
  })
  const stored = storedSecretIn(r, username)
  if (typeof stored === 'string') throw new Error(stored)
  return stored
}

// Waits until the phone's service keeps (`want`) or no longer keeps a stored secret for `username`.
export const waitStoredSecret = async (username: string, want: boolean) =>
  waitFor(
    `the phone ${want ? 'to keep' : 'to drop'} the stored secret of ${username}`,
    async () => ((await storedSecretOf(username)) === want ? true : undefined),
    {interval: 500, timeout: 30_000}
  )

export const loginScreen = async () => jsEval<LoginScreen>(LOGIN_SCREEN_BODY)

// Waits until the login screen would sign `username` in and asks for its password.
export const waitPasswordScreenFor = async (username: string) => {
  let problem: string | undefined
  await waitFor(
    `the login screen to ask for the password of ${username}`,
    async () => {
      problem = passwordScreenProblem(await loginScreen(), username)
      return problem ? undefined : true
    },
    {interval: 500, timeout: 20_000}
  ).catch(() => {
    throw new Error(problem ?? `the login screen never asked for the password of ${username}`)
  })
  await el(T.LOGIN_PASSWORD_INPUT).waitForExist({timeout: 10_000, timeoutMsg: 'the login screen shows no password field'})
}

// Whether the row with rowID (a login-list or account-switcher row) shows `text`: in its own label,
// which merges its children's when the row is one accessible element, or in a child of its own.
export const rowShows = async (rowID: string, text: string) => {
  const row = el(rowID)
  await row.waitForExist({timeout: 10_000, timeoutMsg: `the row ${rowID} never showed`})
  const label = (await row.getAttribute('label').catch(() => null)) ?? ''
  if (label.includes(text)) return true
  return byText(text, row).isExisting()
}

const logInButton = () => labeled('Button', 'Log in')

// Empties the login screen's password field, when it is still mounted. The field takes no value
// prop, so the screen forgetting a password leaves it in the native field.
export const emptyLoginField = async () => {
  if (!(await el(T.LOGIN_PASSWORD_INPUT).isExisting())) return
  await focusSecretField(T.LOGIN_PASSWORD_INPUT)
  await emptySecretField(T.LOGIN_PASSWORD_INPUT)
}

const LOGIN_PASSWORD_SHOWN = "the login screen's password field"

// Runs `f`, which may put a password into the login screen's field, with the secret-on-screen mark
// on (no step, and a failure's screenshot withheld) until the field is gone or empty after it. A
// throw leaves the mark on: the flow's afterEach clears it with clearLoginPasswordMark.
export const withLoginPasswordMarked = async <R,>(f: () => Promise<R>): Promise<R> => {
  markSecretOnScreen(LOGIN_PASSWORD_SHOWN)
  const r = await f()
  await clearLoginPasswordMark()
  return r
}

// Empties the login screen's password field when it is mounted, then clears the mark. Bound: the
// field read 1, emptying it 20.
export const clearLoginPasswordMark = async () => {
  await emptyLoginField()
  clearSecretOnScreen(LOGIN_PASSWORD_SHOWN)
}

const withFieldEmptied = async (e: unknown): Promise<never> => {
  try {
    await emptyLoginField()
  } catch (r) {
    throw new AggregateError([e, r], `${String(e)}; and then emptying the password field failed: ${String(r)}`, {cause: r})
  }
  throw e
}

// Puts `text` into the login screen's password field and presses Log in, once the screen would sign
// `username` in. Used for a wrong password too, so both go the same way.
export const submitLoginPassword = async (username: string, text: string) => {
  await waitPasswordScreenFor(username)
  try {
    await focusSecretField(T.LOGIN_PASSWORD_INPUT)
    await submitSecret(T.LOGIN_PASSWORD_INPUT, text)
    // typing into the field clears the screen's last error (login/relogin/index.tsx)
    await waitFor('the login screen to clear its last error', async () => {
      const s = await loginScreen()
      return s.state === 'shown' && !s.error ? true : undefined
    }, {interval: 250, timeout: 10_000})
    await logInButton().click()
  } catch (e) {
    return withFieldEmptied(e)
  }
}

// Signs `username` in with its password from the login screen and waits until the app is signed in
// as it. A refused or stuck sign-in empties the field (it keeps the password otherwise) and throws
// naming the app's error.
export const signInWithPassword = async (username: string, password: string) => {
  await submitLoginPassword(username, password)
  try {
    const outcome = await waitFor(
      `${username} to sign in with its password`,
      async () => {
        const a = await appAccount().catch(() => undefined)
        if (a?.loggedIn && !a.switching && a.username === username) return {signedIn: true as const}
        const s = await loginScreen().catch(() => undefined)
        return s?.state === 'shown' && s.error ? {error: s.error} : undefined
      },
      {interval: 250, timeout: SIGN_IN_MS}
    )
    if ('error' in outcome) throw new Error(`the login screen refused the password of ${username}: ${outcome.error}`)
  } catch (e) {
    return withFieldEmptied(e)
  }
}


// Puts the second account's stored secret back on the phone when it is missing, by signing it in
// with its password from the login screen, as a person would: from another account through its
// "Signed out" row in the switcher, from the second account itself (signed in, the secret not
// stored) through "Log in as another user", or signed out from the login list. Leaves the app on the
// second account when it signed it in; restoreToSmoke goes back to smoke.
export const restoreSecondSecret = async (password: string) => {
  const {secondUser} = loadE2EAccounts()
  if (await storedSecretOf(secondUser)) return
  const a = await settledAppAccount()
  const loginList = async () => el(T.LOGIN_USER_LIST).isExisting()
  if (a.loggedIn) {
    await openAccountSwitcher()
    const target = a.username === secondUser ? () => labeled('Button', 'Log in as another user') : () => el(T.ACCOUNT_SWITCHER_ROW_PREFIX + secondUser)
    await tapUntil(async () => target().click().catch(() => {}), loginList, 'the switcher never signed out to the login list')
  } else {
    await pressBackToLoginList()
  }
  // the row of an account with no stored secret only selects it
  await tapUntil(
    async () => el(T.LOGIN_USER_ROW_PREFIX + secondUser).click().catch(() => {}),
    async () => passwordScreenProblem(await loginScreen(), secondUser) === undefined,
    `the login screen never asked for the password of ${secondUser}`
  )
  await signInWithPassword(secondUser, password)
  await waitStoredSecret(secondUser, true)
}
