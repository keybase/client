import type {Page} from '@playwright/test'
import {loadE2EAccounts} from '@/tests/e2e/accounts/env'
import {pressHeaderBack, RESTORE_WORST_MS, restoreToSmoke, signedOutThenBack} from '@/tests/e2e/electron/helpers/accounts'
import {test, expect, e2eRunId} from '@/tests/e2e/electron/helpers/fixtures'
import {openMenu} from '@/tests/e2e/electron/helpers/menu'
import {manualEdge, step} from '@/tests/e2e/electron/helpers/step'
import * as T from '@/tests/e2e/shared/test-ids'

// Signup up to its last edge. Accounts are never created: the device-name screen's Continue sends
// the signup itself, so it is never pressed; a person does that by hand (manual-only signup-submit).
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
const continueButton = (page: Page) => page.getByText('Continue', {exact: true}).locator('visible=true')

const openSignup = async (page: Page) => {
  await page.getByText('Create account', {exact: true}).locator('visible=true').click()
  const input = page.getByPlaceholder('Pick a username', {exact: true})
  await expect(input).toBeVisible({timeout: 10_000})
  return input
}

test('signup checks the username and device name and stops before submitting', async ({page}, testInfo) => {
  const {secondUser} = loadE2EAccounts()
  await signedOutThenBack(page, async () => {
    const username = await openSignup(page)
    // the policy checkbox, by its plain words (the rest of the label is a link)
    await page.getByText('I accept the', {exact: false}).locator('visible=true').first().click({position: {x: 4, y: 8}})

    await username.fill(secondUser)
    await continueButton(page).click()
    await expect(page.getByText(/^Sorry, this username is already taken\. Did you mean to/)).toBeVisible({timeout: 20_000})
    await step(page, testInfo, 'taken username')

    await username.fill('a b')
    await continueButton(page).click()
    await expect(page.getByText('No spaces allowed', {exact: true})).toBeVisible({timeout: 5_000})
    await step(page, testInfo, 'invalid username')

    // checkUsernameAvailable, a read, accepts a name no one has
    await username.fill(`e2e${e2eRunId()}su`)
    await continueButton(page).click()
    const device = page.getByPlaceholder('Name', {exact: true})
    await expect(device).toBeVisible({timeout: 20_000})
    await step(page, testInfo, 'device name screen')

    const instructions = page.getByText('Your device name must have 3-64 characters and not end with punctuation.', {exact: true})
    await device.fill('e2e-')
    await expect(instructions).toBeVisible({timeout: 5_000})
    await step(page, testInfo, 'device name refused')

    // the format the service checks on Continue; Continue itself would sign up
    await device.fill(`e2e-${e2eRunId()}-dev`)
    await expect(instructions).toHaveCount(0, {timeout: 5_000})
    await expect(page.getByText('Your device name will be public and can not be changed in the future.', {exact: true})).toBeVisible()
    await manualEdge(page, testInfo, 'signup-submit')

    await pressHeaderBack(page)
    await expect(username).toBeVisible({timeout: 10_000})
    await pressHeaderBack(page)
    await expect(loginList(page)).toBeVisible({timeout: 10_000})
    await step(page, testInfo, 'back on the login screen', {card: true})
  })
})

test("signup's feedback link opens the form and sends nothing", async ({page}, testInfo) => {
  await signedOutThenBack(page, async () => {
    await openSignup(page)
    const sendFeedback = page.getByText('Send feedback', {exact: true}).locator('visible=true')
    await openMenu(page, page.locator('.icon-gen-iconfont-question-mark').locator('visible=true').first(), sendFeedback, 'the signup help menu')
    await sendFeedback.click()
    await expect(page.getByTestId(T.SETTINGS_FEEDBACK).locator('visible=true')).toBeVisible({timeout: 10_000})
    await expect(page.getByText('Send', {exact: true}).locator('visible=true')).toBeVisible()
    await manualEdge(page, testInfo, 'feedback-send')
    await pressHeaderBack(page)
    await expect(page.getByPlaceholder('Pick a username', {exact: true})).toBeVisible({timeout: 10_000})
    await pressHeaderBack(page)
    await expect(loginList(page)).toBeVisible({timeout: 10_000})
  })
})
