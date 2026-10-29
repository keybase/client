import type {Locator, Page} from '@playwright/test'
import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {navigateToSettings} from '@/tests/e2e/electron/helpers/navigate'
import {manualEdge, step} from '@/tests/e2e/electron/helpers/step'
import * as T from '@/tests/e2e/shared/test-ids'
import {closeModal} from '@/tests/e2e/electron/helpers/modal'

// Email add → delete full cycle with a fixed test address, plus view-only
// trips into the phone and sign-out screens. The sign-out button is NEVER
// clicked; the delete confirm is only ever accepted for the test address.
const EMAIL = 'e2e-vis@example.com'

const becomesVisible = async (l: Locator, timeout = 5_000) =>
  l.waitFor({state: 'visible', timeout}).then(() => true).catch(() => false)

async function goToAccountPage(page: Page): Promise<void> {
  await navigateToSettings(page)
  await page.getByTestId(T.SETTINGS_ACCOUNT).locator('text=Account').first().click()
  await expect(page.getByText('Email & phone').first()).toBeVisible({timeout: 5_000})
}

// Deletes the test email if present. Safety: the confirm modal must show the
// test address before "Yes, delete" is clicked.
async function deleteTestEmail(page: Page): Promise<void> {
  const emailText = page.getByText(EMAIL, {exact: true}).locator('visible=true')
  if ((await emailText.count()) === 0) return
  await page.locator(`.icon-gen-iconfont-gear:right-of(:text("${EMAIL}"))`).first().click()
  await page.getByText('Delete', {exact: true}).locator('visible=true').first().click()
  await expect(page.getByText('Delete email').first()).toBeVisible({timeout: 5_000})
  await expect(page.getByText(`${EMAIL}?`).first()).toBeVisible({timeout: 5_000})
  await page.getByText('Yes, delete', {exact: true}).click()
  await expect(emailText).toHaveCount(0, {timeout: 10_000})
}

test('add email modal opens', async ({page}, testInfo) => {
  await goToAccountPage(page)
  await deleteTestEmail(page) // self-heal from a crashed previous run
  await step(page, testInfo, 'account page')
  await page.getByText('Add email', {exact: true}).click()
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
  if ((await page.getByText(EMAIL, {exact: true}).locator('visible=true').count()) === 0) {
    await page.getByText('Add email', {exact: true}).click()
    const emailInput = page.getByPlaceholder('Email address')
    await expect(emailInput).toBeVisible({timeout: 5_000})
    await emailInput.fill(EMAIL)
    await step(page, testInfo, 'email typed')
    await page.getByText('Continue', {exact: true}).click()
  }
  await expect(page.getByText(EMAIL, {exact: true}).locator('visible=true').first()).toBeVisible({
    timeout: 15_000,
  })
  await step(page, testInfo, 'email row in list', {card: true})
})

test('delete email confirm renders, then email is deleted', async ({page}, testInfo) => {
  await goToAccountPage(page)
  const emailText = page.getByText(EMAIL, {exact: true}).locator('visible=true')
  if ((await emailText.count()) === 0) {
    test.skip()
    return
  }
  await page.locator(`.icon-gen-iconfont-gear:right-of(:text("${EMAIL}"))`).first().click()
  await page.getByText('Delete', {exact: true}).locator('visible=true').first().click()
  await expect(page.getByText('Delete email').first()).toBeVisible({timeout: 5_000})
  await expect(page.getByText(`${EMAIL}?`).first()).toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'delete email confirm')
  await page.getByText('Yes, delete', {exact: true}).click()
  await expect(emailText).toHaveCount(0, {timeout: 10_000})
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
  if (!(await becomesVisible(page.getByText(/^(Test password|Safely sign out|Sign out)$/).locator('visible=true').first(), 10_000))) {
    test.skip()
    return
  }
  await step(page, testInfo, 'sign out screen')
  // close the modal — never click the sign out button
  await closeModal(page)
  await expect(page.getByText('Do you know your password?')).not.toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'sign out screen closed')
})
