import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {navigateToSettings, navigateToPeople} from '@/tests/e2e/electron/helpers/navigate'
import {step} from '@/tests/e2e/electron/helpers/step'
import * as T from '@/tests/e2e/shared/test-ids'
import {closeModal} from '@/tests/e2e/electron/helpers/modal'

test('password modal opens', async ({page}, testInfo) => {
  await navigateToSettings(page)
  // the settings tab reopens on the subpage an earlier test left it on: the password is on Account
  await page.getByTestId(T.SETTINGS_ACCOUNT).locator('text=Account').first().click()
  await page.getByText(/^(Change password|Set a password)$/).click({timeout: 5_000})
  await expect(page.getByPlaceholder('New password')).toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'password modal')
  await closeModal(page)
  await expect(page.getByPlaceholder('New password')).not.toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'modal closed')
})

test('account switcher menu opens', async ({page}, testInfo) => {
  await navigateToPeople(page)
  await page.locator('.username').first().click()
  const editProfile = page.getByText('View/Edit profile', {exact: true})
  await expect(editProfile).toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'account switcher menu')
  // Escape, not an outside click: a click on the People feed behind the menu opens whoever is
  // under it, which leaves their profile on the People stack for later tests
  await page.keyboard.press('Escape')
  await expect(editProfile).not.toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'menu closed')
})

test('archive modal opens', async ({page}, testInfo) => {
  await navigateToSettings(page)
  await page.getByTestId(T.SETTINGS_ACCOUNT).locator('text=Backup').click()
  await expect(page.getByTestId(T.SETTINGS_ARCHIVE)).toBeVisible({timeout: 5_000})
  await page.getByText('Backup all chat', {exact: true}).click()
  const blurb = page.getByText('Save a copy of your content to your local drive')
  await expect(blurb).toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'archive modal')
  await closeModal(page)
  await expect(blurb).not.toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'modal closed')
})

test('wallet section renders', async ({page}, testInfo) => {
  await navigateToSettings(page)
  const walletRow = page.getByTestId(T.SETTINGS_ROW_WALLET).locator('visible=true')
  await expect(walletRow, 'the Wallet row in the settings nav').toBeVisible({timeout: 5_000})
  await walletRow.click()
  await expect(page.getByText('Secret key').first()).toBeVisible({timeout: 10_000})
  await step(page, testInfo, 'wallet section')
})
