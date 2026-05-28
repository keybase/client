import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {navigateToPeople} from '@/tests/e2e/electron/helpers/navigate'
import {PEOPLE_FEED} from '@/tests/e2e/shared/test-ids'

test('people tab renders', async ({page}) => {
  await navigateToPeople(page)
  await expect(page.getByTestId(PEOPLE_FEED)).toBeVisible()
})
