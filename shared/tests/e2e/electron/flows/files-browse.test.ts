import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {navigateToFiles} from '@/tests/e2e/electron/helpers/navigate'
import {FILES_BROWSER} from '@/tests/e2e/shared/test-ids'

test('files browser renders', async ({page}) => {
  await navigateToFiles(page)
  await expect(page.getByTestId(FILES_BROWSER)).toBeVisible()
})
