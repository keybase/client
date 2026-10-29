// Runs part of a flow as another account, or signed out, and always puts the app back on the smoke
// account. The app's service is the main service, so switching the app switches it too; each
// wrapper checks it is back on the smoke account before it returns.
import {expect, type Page} from '@playwright/test'
import {loadE2EAccounts} from '@/tests/e2e/accounts/env'
import {mainWhoami, requireMainIsSmoke} from '@/tests/e2e/shared/peer-service'
import * as T from '@/tests/e2e/shared/test-ids'
import {signedInAs, switchAccount} from './chat'
import {openMenu} from './menu'
import {navigateToChat} from './navigate'
import {nameMatcher, tabBarName} from './second-sign-in'

// signs in from a stored secret, so seconds; the bound covers a slow service
const SIGN_IN_MS = 30_000

// Runs `f` with the app (and the main service) switched to the second account, through the app's
// own account switcher, then switches back to the smoke account whether `f` passed or threw.
export const asSecond = async <T,>(page: Page, f: () => Promise<T>): Promise<T> => {
  const {secondUser, smokeUser} = loadE2EAccounts()
  let result: T
  try {
    await switchAccount(page, secondUser)
    result = await f()
  } catch (e) {
    // a failed switch back keeps the first error too
    try {
      await switchAccount(page, smokeUser)
    } catch (r) {
      throw new AggregateError([e, r], `${String(e)}; and then switching back to the smoke account failed: ${String(r)}`, {cause: r})
    }
    await requireMainIsSmoke({smokeUser})
    throw e
  }
  await switchAccount(page, smokeUser)
  await requireMainIsSmoke({smokeUser})
  return result
}

// Signs the app out from the user menu's "Log in as another user" (the smoke account keeps its
// stored secret, so it stays in the login screen's list), runs `f` on the login screen, then signs
// the smoke account back in whether `f` passed or threw.
export const signedOutThenBack = async <T,>(page: Page, f: () => Promise<T>): Promise<T> => {
  try {
    const anotherUser = page.getByText('Log in as another user', {exact: true})
    await openMenu(page, tabBarName(page), anotherUser, 'the user menu')
    await anotherUser.click({timeout: 5_000})
    await expect(page.getByTestId(T.LOGIN_USER_LIST)).toBeVisible({timeout: SIGN_IN_MS})
    return await f()
  } finally {
    await restoreToSmoke(page)
  }
}

// The visible header's back arrow: screens left behind stay mounted, hidden, with their own.
const headerBack = (page: Page) => page.locator('.icon-gen-iconfont-arrow-left').locator('visible=true').first()
export const pressHeaderBack = async (page: Page) => {
  await headerBack(page).click({timeout: 5_000})
}

// restoreToSmoke's longest run before one of its own deadlines fails it: backing out (6 x 5.5s), the
// login list (30s), the pick and the sign-in (5s + 30s), the chat tab (5s), whoami (15s); a hook
// that runs it gives itself this much on top of what the test used.
export const RESTORE_WORST_MS = 150_000

// Back to the smoke account: signed in as another account, through the account switcher; signed
// out, from the login screen (backing out of any screen pushed over it) by picking the smoke
// account in its list, which signs in with the stored secret (no password). Does nothing when the
// app is already on the smoke account.
export const restoreToSmoke = async (page: Page) => {
  const {smokeUser} = loadE2EAccounts()
  const signedIn = await tabBarName(page).isVisible()
  if (signedIn && (await signedInAs(page)) !== smokeUser) {
    await switchAccount(page, smokeUser)
  } else if (!signedIn) {
    const list = page.getByTestId(T.LOGIN_USER_LIST)
    // a signed-out flow that failed part way leaves a screen pushed over the login screen
    for (let i = 0; i < 6 && !(await list.isVisible()); i++) {
      if (!(await headerBack(page).isVisible())) break
      await pressHeaderBack(page)
      await page.waitForTimeout(500)
    }
    await expect(list, 'the login screen to show its account list (restoreToSmoke starts from it)').toBeVisible({timeout: SIGN_IN_MS})
    await list.getByText(smokeUser, {exact: true}).click({timeout: 5_000})
    await expect(tabBarName(page)).toHaveText(nameMatcher(smokeUser), {timeout: SIGN_IN_MS})
    await navigateToChat(page)
  }
  await requireMainIsSmoke({smokeUser})
}

// Who the main service is signed in as, or '' when it is signed out (whoami then fails saying so).
export const mainWhoamiOrSignedOut = async () =>
  mainWhoami().catch((e: unknown) => {
    if (/logged out|not logged in/i.test(String(e))) return ''
    throw e
  })
