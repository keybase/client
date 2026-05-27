import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {navigateToDevices} from '@/tests/e2e/electron/helpers/navigate'
import {DEVICES_LIST} from '@/tests/e2e/shared/test-ids'

test('devices tab renders', async ({page}) => {
  await navigateToDevices(page)
  await expect(page.getByTestId(DEVICES_LIST).first()).toBeVisible()
})
