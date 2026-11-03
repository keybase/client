import type {Page} from '@playwright/test'
import {loadE2EAccounts, loadE2EEnv, requireSecondPassword, type E2EEnv} from '@/tests/e2e/accounts/env'
import {CHECK_OR_REPAIR_WORST_MS, checkOrRepairSecondSecret} from '@/tests/e2e/accounts/second-password-lib'
import {asSecond, RESTORE_WORST_MS, restoreToSmoke} from '@/tests/e2e/electron/helpers/accounts'
import {appRepairDeps, submitSecret} from '@/tests/e2e/electron/helpers/second-sign-in'
import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {navigateToSettings} from '@/tests/e2e/electron/helpers/navigate'
import {step} from '@/tests/e2e/electron/helpers/step'
import {requireMainIsSmoke} from '@/tests/e2e/shared/peer-service'
import * as T from '@/tests/e2e/shared/test-ids'

// The second account signs out (Settings > Sign out, which drops its stored secret) and back in with
// its password, KB_SECOND_PASSWORD, which only submitSecret ever types (no step, action or
// assertion while the field holds it). The password login stores the secret again, which afterAll
// checks; if the test stopped before it, the check fails and the repair signs the second account in
// through the app. That runs between tests, since switching the main service switches the app.
test.describe.configure({mode: 'serial'})
// The password is typed here. A retry's trace snapshots every input's value, and a retry would
// type it again, so this file never retries and never traces.
test.describe.configure({retries: 0})
test.use({trace: 'off'})
// Every action is bounded, so a flow stuck on a screen fails with time left for the sign-in back to
// smoke; afterEach signs smoke in again if a failure left the app elsewhere.
test.use({actionTimeout: 10_000})
test.afterEach(async ({page}, testInfo) => {
  testInfo.setTimeout(testInfo.timeout + RESTORE_WORST_MS)
  await restoreToSmoke(page)
})
// two account switches, a sign-out and two logins
test.describe.configure({timeout: 120_000})

let env: E2EEnv
let password = ''
test.beforeAll(() => {
  env = loadE2EEnv()
  password = requireSecondPassword(env)
})

// The repair signs in on this worker's own page (untraced, as above), not a connection of its own.
test.afterAll(async ({_electronPage}, testInfo) => {
  // the default 30s would kill a repair part way and leave the main service signed out
  testInfo.setTimeout(CHECK_OR_REPAIR_WORST_MS + 15_000)
  // beforeAll already failed naming the missing variable; nothing was typed, so nothing to check
  if (!password) return
  await checkOrRepairSecondSecret(env, password, appRepairDeps(_electronPage))
  await requireMainIsSmoke(env)
})

const loginList = (page: Page) => page.getByTestId(T.LOGIN_USER_LIST)
const passwordInput = (page: Page) => page.getByPlaceholder('Password', {exact: true}).locator('visible=true')
const logIn = (page: Page) => page.getByText('Log in', {exact: true}).locator('visible=true').last()

test('log out and back in with the password', async ({page}, testInfo) => {
  const {secondUser} = loadE2EAccounts()
  await asSecond(page, async () => {
    try {
      await navigateToSettings(page)
      await page.getByText('Sign out', {exact: true}).locator('visible=true').first().click()
      await page.getByText('Just sign out', {exact: true}).locator('visible=true').click({timeout: 10_000})
      await expect(loginList(page)).toBeVisible({timeout: 30_000})
      // the account that signed out is the one selected, and it needs its password now
      await expect(passwordInput(page)).toBeVisible({timeout: 10_000})
      await expect(loginList(page).getByText(secondUser, {exact: true})).toBeAttached()
      await step(page, testInfo, 'signed out, password asked')

      await passwordInput(page).fill('e2e-not-the-password')
      await logIn(page).click()
      await expect(page.getByText('Incorrect password.', {exact: true}).locator('visible=true')).toBeVisible({timeout: 30_000})
      await step(page, testInfo, 'wrong password refused')

      // no Playwright action or assertion while the field holds the password (see submitSecret)
      await submitSecret(page, passwordInput(page), password, secondUser)
      await step(page, testInfo, 'signed in as second', {card: true})
    } catch (e) {
      // left signed out (on the login screen or a screen over it), asSecond cannot switch back;
      // smoke signs in from there first
      if (!(await page.locator('.username').first().isVisible())) {
        await restoreToSmoke(page).catch((r: unknown) => {
          throw new AggregateError([e, r], `${String(e)}; and then signing the smoke account back in failed: ${String(r)}`)
        })
      }
      throw e
    }
  })
})
