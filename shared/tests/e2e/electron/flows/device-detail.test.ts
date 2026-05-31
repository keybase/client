import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {navigateToDevices} from '@/tests/e2e/electron/helpers/navigate'
import {DEVICES_ROW, DEVICE_PAGE} from '@/tests/e2e/shared/test-ids'

test('device detail page renders', async ({page}) => {
  await navigateToDevices(page)
  await page.getByTestId(DEVICES_ROW).first().click()
  await expect(page.getByTestId(DEVICE_PAGE).first()).toBeVisible({timeout: 5_000})
})
