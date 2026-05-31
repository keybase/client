import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {navigateToGit} from '@/tests/e2e/electron/helpers/navigate'
import {GIT_REPO_LIST, GIT_REPO_ROW} from '@/tests/e2e/shared/test-ids'

test('git repo list renders', async ({page}) => {
  await navigateToGit(page)
  await expect(page.getByTestId(GIT_REPO_LIST).first()).toBeVisible()
})

test('git repo row is visible if repos exist', async ({page}) => {
  await navigateToGit(page)
  const rows = page.getByTestId(GIT_REPO_ROW)
  const count = await rows.count()
  if (count === 0) {
    test.skip()
    return
  }
  await expect(rows.first()).toBeVisible()
})
