import type {Page, TestInfo} from '@playwright/test'
import {test, expect, e2eRunId} from '@/tests/e2e/electron/helpers/fixtures'
import {navigateToSettings} from '@/tests/e2e/electron/helpers/navigate'
import {manualEdge, step} from '@/tests/e2e/electron/helpers/step'
import * as T from '@/tests/e2e/shared/test-ids'
import {closeModal} from '@/tests/e2e/electron/helpers/modal'

// Email add → delete full cycle with an address named for the run (the sweeper clears one a crashed
// run leaves) on example.com, which RFC 2606 reserves, so the verification mail reaches no one.
// Plus view-only trips into the phone and sign-out screens. The sign-out button is NEVER clicked;
// the delete confirm is only ever accepted for the test address.
const EMAIL = `e2e-${e2eRunId()}-mail@example.com`

// Scoped to the Account page: the People feed and the settings icons debug page stay mounted,
// hidden, and hold matching text and gears too.
const accountPage = (page: Page) => page.getByTestId(T.SETTINGS_ACCOUNT_PAGE)
const emailRow = (page: Page) => accountPage(page).getByText(EMAIL, {exact: true}).locator('visible=true')
const emailGear = (page: Page) => accountPage(page).locator(`.icon-gen-iconfont-gear:visible:right-of(:text-is("${EMAIL}"))`).first()

// The Account page with its emails loaded: the primary address's row is always there.
async function goToAccountPage(page: Page): Promise<void> {
  await navigateToSettings(page)
  await page.getByTestId(T.SETTINGS_ACCOUNT).locator('text=Account').first().click()
  await expect(accountPage(page).getByText('Email & phone').first()).toBeVisible({timeout: 5_000})
  await expect(accountPage(page).getByText(/Primary/).locator('visible=true').first(), 'the account emails to load').toBeVisible({
    timeout: 10_000,
  })
}

async function addTestEmail(page: Page, testInfo: TestInfo): Promise<void> {
  await accountPage(page).getByText('Add email', {exact: true}).click()
  const emailInput = page.getByPlaceholder('Email address')
  await expect(emailInput).toBeVisible({timeout: 5_000})
  await emailInput.fill(EMAIL)
  await step(page, testInfo, 'email typed')
  await page.getByText('Continue', {exact: true}).click()
  await expect(emailInput).not.toBeVisible({timeout: 15_000})
  await expect(emailRow(page).first()).toBeVisible({timeout: 15_000})
}

test('add email modal opens', async ({page}, testInfo) => {
  await goToAccountPage(page)
  await step(page, testInfo, 'account page')
  await accountPage(page).getByText('Add email', {exact: true}).click()
  const emailInput = page.getByPlaceholder('Email address')
  await expect(emailInput).toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'add email modal', {card: true})
  await page.getByText('Cancel', {exact: true}).locator('visible=true').first().click()
  await expect(emailInput).not.toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'modal closed')
})

test('added email row renders', async ({page}, testInfo) => {
  await goToAccountPage(page)
  await step(page, testInfo, 'account page')
  // a retry finds the address its first attempt added
  if ((await emailRow(page).count()) === 0) await addTestEmail(page, testInfo)
  await expect(emailRow(page).first()).toBeVisible()
  await step(page, testInfo, 'email row in list', {card: true})
})

test('delete email confirm renders, then email is deleted', async ({page}, testInfo) => {
  await goToAccountPage(page)
  // run alone (or after the add test failed), it adds the address it deletes
  if ((await emailRow(page).count()) === 0) await addTestEmail(page, testInfo)
  await emailGear(page).click()
  await page.getByText('Delete', {exact: true}).locator('visible=true').first().click()
  await expect(page.getByText('Delete email').first()).toBeVisible({timeout: 5_000})
  await expect(page.getByText(`${EMAIL}?`).first()).toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'delete email confirm')
  await page.getByText('Yes, delete', {exact: true}).click()
  await expect(emailRow(page)).toHaveCount(0, {timeout: 10_000})
  await step(page, testInfo, 'email row gone')
})

test('add phone modal opens', async ({page}, testInfo) => {
  await goToAccountPage(page)
  await step(page, testInfo, 'account page')
  await page.getByText('Add phone number', {exact: true}).click()
  const continueButton = page.getByText('Continue', {exact: true}).locator('visible=true')
  await expect(continueButton.first()).toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'add phone modal', {card: true})
  await manualEdge(page, testInfo, 'sms-code')
  await page.getByText('Cancel', {exact: true}).locator('visible=true').first().click()
  await expect(continueButton).toHaveCount(0, {timeout: 5_000})
  await step(page, testInfo, 'modal closed')
})

test('sign out screen renders (without signing out)', async ({page}, testInfo) => {
  await navigateToSettings(page)
  await page.getByTestId(T.SETTINGS_ACCOUNT).locator('text=Sign out').first().click()
  // password accounts get a "Test password" screen; randomPW accounts get "Sign out"
  await expect(
    page.getByText(/^(Test password|Safely sign out|Sign out)$/).locator('visible=true').first(),
    'the sign out screen'
  ).toBeVisible({timeout: 10_000})
  await step(page, testInfo, 'sign out screen')
  // close the modal — never click the sign out button
  await closeModal(page)
  await expect(page.getByText('Do you know your password?')).not.toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'sign out screen closed')
})
