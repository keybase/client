import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {navigateToSettings} from '@/tests/e2e/electron/helpers/navigate'
import {SETTINGS_ACCOUNT} from '@/tests/e2e/shared/test-ids'

test('settings nav renders', async ({page}) => {
  await navigateToSettings(page)
  await expect(page.getByTestId(SETTINGS_ACCOUNT)).toBeVisible()
})

test('can click Account settings', async ({page}) => {
  await navigateToSettings(page)
  // earlier tests may leave another settings subpage selected — go to Account first
  await page.getByTestId(SETTINGS_ACCOUNT).locator('text=Account').first().click()
  await expect(page.getByText('Your account').first()).toBeVisible({timeout: 5_000})
})
