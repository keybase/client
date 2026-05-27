import {test, expect, type Page} from '@playwright/test'
import {connectToElectron, disconnect} from '@/tests/e2e/electron/helpers/connect'
import {navigateToGit} from '@/tests/e2e/electron/helpers/navigate'
import {GIT_REPO_LIST} from '@/tests/e2e/shared/test-ids'

let page: Page

test.beforeAll(async () => {
  ;({page} = await connectToElectron())
})

test.afterAll(async () => {
  await disconnect()
})

test('git tab renders', async () => {
  await navigateToGit(page)
  await expect(page.getByTestId(GIT_REPO_LIST).first()).toBeVisible()
})
