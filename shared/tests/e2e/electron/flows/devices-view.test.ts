import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {navigateToDevices} from '@/tests/e2e/electron/helpers/navigate'
import {DEVICES_LIST, DEVICES_ROW} from '@/tests/e2e/shared/test-ids'

test('devices list renders', async ({page}) => {
  await navigateToDevices(page)
  await expect(page.getByTestId(DEVICES_LIST).first()).toBeVisible()
})

test('devices list has at least one device', async ({page}) => {
  await navigateToDevices(page)
  await expect(page.getByTestId(DEVICES_ROW).first()).toBeVisible({timeout: 10_000})
})
