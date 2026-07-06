import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {navigateToSettings, navigateToPeople} from '@/tests/e2e/electron/helpers/navigate'
import {snap} from '@/tests/e2e/electron/helpers/snap'
import * as T from '@/tests/e2e/shared/test-ids'

test('password modal opens', async ({page}, testInfo) => {
  await navigateToSettings(page)
  await page.getByText(/^(Change password|Set a password)$/).click()
  await expect(page.getByPlaceholder('New password')).toBeVisible({timeout: 5_000})
  await snap(page, testInfo)
  await page.locator('.icon-gen-iconfont-close:visible').first().click()
  await expect(page.getByPlaceholder('New password')).not.toBeVisible({timeout: 5_000})
})

test('account switcher menu opens', async ({page}, testInfo) => {
  await navigateToPeople(page)
  await page.locator('.username').first().click()
  const editProfile = page.getByText('View/Edit profile', {exact: true})
  await expect(editProfile).toBeVisible({timeout: 5_000})
  await snap(page, testInfo)
  await page.mouse.click(600, 400)
  await expect(editProfile).not.toBeVisible({timeout: 5_000})
})

test('archive modal opens', async ({page}, testInfo) => {
  await navigateToSettings(page)
  await page.getByTestId(T.SETTINGS_ACCOUNT).locator('text=Backup').click()
  await expect(page.getByTestId(T.SETTINGS_ARCHIVE)).toBeVisible({timeout: 5_000})
  await page.getByText('Backup all chat', {exact: true}).click()
  const blurb = page.getByText('Save a copy of your content to your local drive')
  await expect(blurb).toBeVisible({timeout: 5_000})
  await snap(page, testInfo)
  await page.locator('.icon-gen-iconfont-close:visible').first().click()
  await expect(blurb).not.toBeVisible({timeout: 5_000})
})

test('wallet section renders', async ({page}, testInfo) => {
  await navigateToSettings(page)
  const walletRow = page.getByTestId(T.SETTINGS_ACCOUNT).locator('text=Wallet')
  if ((await walletRow.count()) === 0) {
    test.skip()
    return
  }
  await walletRow.click()
  await expect(page.getByText('Secret key').first()).toBeVisible({timeout: 10_000})
  await snap(page, testInfo)
})
