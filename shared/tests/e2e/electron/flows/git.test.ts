import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {navigateToGit} from '@/tests/e2e/electron/helpers/navigate'
import {GIT_REPO_LIST, GIT_REPO_ROW} from '@/tests/e2e/shared/test-ids'

test('git repo list renders', async ({page}) => {
  await navigateToGit(page)
  await expect(page.getByTestId(GIT_REPO_LIST).first()).toBeVisible()
})

test('git repo row is visible', async ({page}) => {
  await navigateToGit(page)
  // the smoke account holds personal git repos (git-mutations makes a run-stamped one too)
  await expect(page.getByTestId(GIT_REPO_ROW).first(), 'a git repo row for the smoke account').toBeVisible({timeout: 10_000})
})
