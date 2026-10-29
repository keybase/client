import type {Page} from '@playwright/test'
import {loadE2EAccounts} from '@/tests/e2e/accounts/env'
import {mainWhoamiOrSignedOut, pressHeaderBack, RESTORE_WORST_MS, restoreToSmoke, signedOutThenBack} from '@/tests/e2e/electron/helpers/accounts'
import {test, expect, e2eRunId} from '@/tests/e2e/electron/helpers/fixtures'
import {manualEdge, step} from '@/tests/e2e/electron/helpers/step'
import * as T from '@/tests/e2e/shared/test-ids'

// The login screen and the screens it opens while no account is signed in. Each test signs the app
// out ("Log in as another user", which keeps the stored secrets) and signs the smoke account back in.
test.describe.configure({mode: 'serial'})
// Every action is bounded, so a flow stuck on a screen fails with time left for the sign-in back to
// smoke; afterEach signs smoke in again if a failure left the app elsewhere.
test.use({actionTimeout: 10_000})
test.afterEach(async ({page}, testInfo) => {
  testInfo.setTimeout(testInfo.timeout + RESTORE_WORST_MS)
  await restoreToSmoke(page)
})
// a sign-out and a sign-in around the flow, with room for the sign-in after a failure
test.describe.configure({timeout: 60_000})

const loginList = (page: Page) => page.getByTestId(T.LOGIN_USER_LIST)

// "Someone else..." starts a login for an account not listed: the username screen
const openUsernameScreen = async (page: Page) => {
  await loginList(page).getByText('Someone else...', {exact: true}).click()
  const input = page.getByPlaceholder('Username', {exact: true})
  await expect(input).toBeVisible({timeout: 10_000})
  return input
}

test('add account signs out to the login screen with both accounts listed', async ({page}, testInfo) => {
  const {secondUser, smokeUser} = loadE2EAccounts()
  await signedOutThenBack(page, async () => {
    await expect(loginList(page).getByText(smokeUser, {exact: true})).toBeVisible()
    await loginList(page).getByText(secondUser, {exact: true}).scrollIntoViewIfNeeded()
    await expect(loginList(page).getByText(secondUser, {exact: true})).toBeVisible()
    expect(await mainWhoamiOrSignedOut()).toBe('')
    await step(page, testInfo, 'login screen lists both accounts', {card: true})
  })
})

test('feedback opens from the login screen and sends nothing', async ({page}, testInfo) => {
  await signedOutThenBack(page, async () => {
    // Desktop's login screen has no feedback link (only the phone's has "Problems logging in?"):
    // signed out, desktop opens `feedback` only from the global error bar. The error is injected
    // into the config store as setup, the way the visual gate's overlay/globalError fixture does;
    // the route is then opened by the bar's own button.
    await page.evaluate(() => {
      type Config = {getState: () => {dispatch: {setGlobalError: (e?: unknown) => void}}}
      const store = (globalThis as {__ZUSTAND_HMR__?: Map<string, unknown>}).__ZUSTAND_HMR__?.get('config') as Config | undefined
      if (!store) throw new Error('the config store is not in __ZUSTAND_HMR__; is this a dev build?')
      store.getState().dispatch.setGlobalError(new Error('e2e: an error set so the signed-out error bar shows'))
    })
    const bar = page.getByTestId(T.GLOBAL_ERROR)
    await expect(bar).toBeVisible({timeout: 5_000})
    await step(page, testInfo, 'error bar over the login screen')
    await bar.getByText('Please tell us', {exact: true}).click()
    const form = page.getByTestId(T.SETTINGS_FEEDBACK).locator('visible=true')
    await expect(form).toBeVisible({timeout: 10_000})
    await expect(page.getByText('Send', {exact: true}).locator('visible=true')).toBeVisible()
    await manualEdge(page, testInfo, 'feedback-send')
    await pressHeaderBack(page)
    await expect(loginList(page)).toBeVisible({timeout: 10_000})
  })
})

test('forgot username sends to an example.com address', async ({page}, testInfo) => {
  await signedOutThenBack(page, async () => {
    await openUsernameScreen(page)
    await page.getByText('Forgot username?', {exact: true}).click()
    const email = page.getByPlaceholder('Email address', {exact: true})
    await expect(email).toBeVisible({timeout: 10_000})
    await email.fill(`e2e-${e2eRunId()}-fu@example.com`)
    await step(page, testInfo, 'example.com address typed')
    // the screen's title says the same: the button is the last
    await page.getByText('Recover username', {exact: true}).locator('visible=true').last().click()
    // the service answers an address no account has as it does any other: it says it sent the mail
    await expect(page.getByText('We just sent you your username.', {exact: true})).toBeVisible({timeout: 20_000})
    await step(page, testInfo, 'service answered', {card: true})
  })
})

test('an unknown username shows the not-found banner', async ({page}, testInfo) => {
  await signedOutThenBack(page, async () => {
    const input = await openUsernameScreen(page)
    await input.fill(`e2e${e2eRunId()}nouser`)
    await page.getByText('Log in', {exact: true}).locator('visible=true').last().click()
    await expect(page.getByText(/^This username doesn't exist\. Did you mean to/)).toBeVisible({timeout: 20_000})
    await step(page, testInfo, 'username not found', {card: true})
  })
})
