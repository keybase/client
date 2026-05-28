import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {navigateToGit} from '@/tests/e2e/electron/helpers/navigate'
import {GIT_REPO_LIST} from '@/tests/e2e/shared/test-ids'

test('git tab renders', async ({page}) => {
  await navigateToGit(page)
  await expect(page.getByTestId(GIT_REPO_LIST).first()).toBeVisible()
})
