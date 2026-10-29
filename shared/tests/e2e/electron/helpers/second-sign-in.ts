// Signs an account in on the main service through the app's own login screen, with its password.
// This is how the harness puts back the main service's stored secret for the second account: the
// service routes every password prompt to the app (its registered secret UI), and the app answers
// none while it is signed out, so the service cannot be asked on a connection of the harness's own.
// A password login from the login screen stores the secret again: Go's LoginProvisionedDevice
// stores it after any password login (tryPassphraseLogin), whatever storeSecret the app answers.
//
// Relative imports only: the setup command (node, no path aliases) loads this too.
import {chromium, expect, type Locator, type Page} from '@playwright/test'
import escapeRegExp from 'lodash/escapeRegExp.js'
import type {E2EEnv} from '../../accounts/env.ts'
import {checkSecondSecretSurvives, liveMain, repairSecondSecret, sayMasked, type RepairDeps} from '../../accounts/second-password-lib.ts'
import {LOGIN_USER_LIST} from '../../shared/test-ids.ts'
import {findMainPage} from './connect.ts'
import {openMenu} from './menu.ts'
import {emptyFocusedField, fieldLengths, insertSecret, pressReturn, withoutSecret, type SecretWindow} from './secret-input.ts'

// a sign-in from a stored secret takes seconds; the bound covers a slow service
const SIGN_IN_MS = 30_000

// the tab bar's "Hi <name>!", which opens the user menu
export const tabBarName = (page: Page) => page.locator('.username').first()
export const nameMatcher = (user: string) => new RegExp(`^(Hi )?${escapeRegExp(user)}!?$`)

type Dom = {
  document: {
    querySelector: (q: string) => {textContent: string | null} | null
    querySelectorAll: (q: string) => ArrayLike<{textContent: string | null; click?: () => void}>
  }
}

const MAIN: SecretWindow = 'main.html'
const PASSWORD_FIELDS = 'input[type=password]'

// Empties the focused password field (emptyFocusedField: each password field must read back ''),
// then leaves the login screen for signup's first screen (no RPC), which unmounts the field.
export const clearAndLeavePasswordScreen = async (page: Page) => {
  await emptyFocusedField(page, MAIN, PASSWORD_FIELDS)
  await page
    .evaluate(() => {
      const link = Array.from((globalThis as unknown as Dom).document.querySelectorAll('span')).find(e => e.textContent === 'Create account')
      link?.click?.()
    })
    .catch(() => {})
  const gone = Date.now() + 5_000
  while ((await fieldLengths(page, PASSWORD_FIELDS))?.length && Date.now() < gone) {
    await new Promise(resolve => setTimeout(resolve, 100))
  }
}

// Types `secret` into the login screen's password field, submits it, and waits for the tab bar to
// name `user`, with no Playwright action or assertion while the field holds it (see
// secret-input.ts); on failure the field is emptied and unmounted (clearAndLeavePasswordScreen)
// before a plain error, naming no value, is thrown.
export const submitSecret = async (page: Page, input: Locator, secret: string, user: string, timeoutMs = 30_000) => {
  // the field is still empty here
  await input.click({timeout: 5_000})
  let failure: string | undefined
  try {
    // Enter only once the app holds all of it: an Enter ahead of the text submits an empty field
    failure = await insertSecret(page, MAIN, PASSWORD_FIELDS, secret)
    if (!failure) await pressReturn(MAIN)
    const deadline = Date.now() + timeoutMs
    while (!failure && Date.now() < deadline) {
      const name = await page.evaluate(() => (globalThis as unknown as Dom).document.querySelector('.username')?.textContent ?? '').catch(() => '')
      if (nameMatcher(user).test(name.trim())) return
      await new Promise(resolve => setTimeout(resolve, 250))
    }
    failure ??= `the app did not sign ${user} in within ${timeoutMs / 1000}s of submitting the password`
  } catch (e) {
    failure = `submitting the password failed: ${withoutSecret(e, secret)}`
  }
  await clearAndLeavePasswordScreen(page)
  throw new Error(failure)
}

// The user menu's "Log in as another user": the login screen, the signed-in account kept in its
// list with its stored secret.
const toLoginScreen = async (page: Page) => {
  const another = page.getByText('Log in as another user', {exact: true})
  await openMenu(page, tabBarName(page), another, 'the user menu')
  await another.click({timeout: 5_000})
  await expect(page.getByTestId(LOGIN_USER_LIST)).toBeVisible({timeout: SIGN_IN_MS})
}

// Picks `user` in the login screen's list; a row with a stored secret signs in at once.
const pickOnLoginScreen = async (page: Page, user: string) => {
  await page.getByTestId(LOGIN_USER_LIST).getByText(user, {exact: true}).click({timeout: 5_000})
}

// Back on the smoke account from wherever the sign-in stopped: the login screen, or signed in as
// another account (through the login screen again, since smoke has a stored secret).
const backToSmokeInApp = async (page: Page, smokeUser: string) => {
  const list = page.getByTestId(LOGIN_USER_LIST)
  if (!(await list.isVisible())) {
    const name = (await tabBarName(page).innerText({timeout: 5_000})).trim()
    if (nameMatcher(smokeUser).test(name)) return
    await toLoginScreen(page)
  }
  await pickOnLoginScreen(page, smokeUser)
  await expect(tabBarName(page)).toHaveText(nameMatcher(smokeUser), {timeout: SIGN_IN_MS})
}

// From the app signed in as the smoke account: "Log in as another user", `user`'s row (with no
// stored secret it asks for the password), the password (submitSecret), and back to the smoke
// account. Throws if the app does not end on the smoke account; a failure there after a failed
// sign-in keeps both errors.
export const signInThroughApp = async (page: Page, env: Pick<E2EEnv, 'smokeUser'>, user: string, password: string) => {
  const input = page.getByPlaceholder('Password', {exact: true}).locator('visible=true')
  let failure: unknown
  try {
    await toLoginScreen(page)
    await pickOnLoginScreen(page, user)
    // a row with a stored secret signs in at once and asks for nothing
    const asked = await input
      .waitFor({state: 'visible', timeout: 5_000})
      .then(() => true)
      .catch(() => false)
    if (asked) {
      await submitSecret(page, input, password, user, SIGN_IN_MS)
    } else {
      await expect(tabBarName(page)).toHaveText(nameMatcher(user), {timeout: SIGN_IN_MS})
    }
  } catch (e) {
    failure = e
  }
  try {
    await backToSmokeInApp(page, env.smokeUser)
  } catch (r) {
    if (failure === undefined) throw r
    throw new AggregateError([failure, r], `${message(failure)}; and then signing the smoke account back in failed: ${message(r)}`, {
      cause: r,
    })
  }
  if (failure !== undefined) throw failure instanceof Error ? failure : new Error(message(failure))
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

// checkOrRepairSecondSecret's check and repair for a flow: the repair signs in on the flow's own
// page (untraced in every file that can run it), not a CDP connection of its own.
export const appRepairDeps = (page: Page): RepairDeps => ({
  check: async e => checkSecondSecretSurvives(e),
  repair: async (e, pw) => repairSecondSecret(e, pw, {...liveMain(), signIn: async (e2, pw2) => signInThroughApp(page, e2, e2.secondUser, pw2)}),
  say: sayMasked,
})

// signInThroughApp on the running app from outside a test (the setup command): over a CDP
// connection of its own, with no trace or recording, closed after. A connectOverCDP browser's close
// drops only this connection: the app's own context and window stay (seen live: the app kept
// running and the next flow passed).
export const signSecondInThroughApp = async (env: Pick<E2EEnv, 'smokeUser' | 'secondUser'>, password: string) => {
  const browser = await chromium.connectOverCDP('http://localhost:9222', {timeout: 5_000})
  try {
    await signInThroughApp(findMainPage(browser), env, env.secondUser, password)
  } finally {
    await browser.close()
  }
}
