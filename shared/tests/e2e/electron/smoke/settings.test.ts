import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {navigateToSettings} from '@/tests/e2e/electron/helpers/navigate'
import {SETTINGS_ACCOUNT} from '@/tests/e2e/shared/test-ids'

test('settings tab renders', async ({page}) => {
  await navigateToSettings(page)
  await expect(page.getByTestId(SETTINGS_ACCOUNT)).toBeVisible()
})
