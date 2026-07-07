import type {Page} from '@playwright/test'
import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {navigateToGit} from '@/tests/e2e/electron/helpers/navigate'
import {snap} from '@/tests/e2e/electron/helpers/snap'
import * as T from '@/tests/e2e/shared/test-ids'

// Full create → delete cycle on a personal repo with a fixed name. The tests in
// this file run in order and depend on each other; deleteRepoIfExists at the
// start of the create test makes a crashed earlier run self-heal.
const REPO_NAME = 'e2e-vis-repo'

// repo create/delete RPCs can outlive the default 15s test timeout
test.beforeEach(() => test.setTimeout(60_000))

function repoRow(page: Page) {
  return page.getByTestId(T.GIT_REPO_ROW).filter({hasText: REPO_NAME})
}

async function deleteRepo(page: Page): Promise<void> {
  await repoRow(page).first().click()
  await page.getByText('Delete repo', {exact: true}).click()
  const confirmInput = page.getByPlaceholder('Name of the repository')
  await expect(confirmInput).toBeVisible({timeout: 5_000})
  await confirmInput.fill(REPO_NAME)
  await page.getByText('Delete this repository', {exact: true}).click()
  await expect(repoRow(page)).toHaveCount(0, {timeout: 30_000})
}

test('new repo modal opens', async ({page}, testInfo) => {
  await navigateToGit(page)
  // self-heal: remove a leftover repo from a crashed previous run
  if ((await repoRow(page).count()) > 0) {
    await deleteRepo(page)
  }
  await page.getByText('New repository', {exact: true}).click()
  await page.getByText('New personal repository', {exact: true}).click()
  const nameInput = page.getByPlaceholder('Name your repository')
  await expect(nameInput).toBeVisible({timeout: 5_000})
  await snap(page, testInfo)
  await page.locator('.icon-gen-iconfont-close:visible').first().click()
  await expect(nameInput).not.toBeVisible({timeout: 5_000})
})

test('created repo row renders', async ({page}, testInfo) => {
  await navigateToGit(page)
  if ((await repoRow(page).count()) === 0) {
    await page.getByText('New repository', {exact: true}).click()
    await page.getByText('New personal repository', {exact: true}).click()
    const nameInput = page.getByPlaceholder('Name your repository')
    await expect(nameInput).toBeVisible({timeout: 5_000})
    await nameInput.fill(REPO_NAME)
    await page.getByText('Create', {exact: true}).click()
  }
  await expect(repoRow(page).first()).toBeVisible({timeout: 30_000})
  await snap(page, testInfo)
})

test('delete repo confirm renders, then repo is deleted', async ({page}, testInfo) => {
  await navigateToGit(page)
  if ((await repoRow(page).count()) === 0) {
    test.skip()
    return
  }
  await repoRow(page).first().click()
  await page.getByText('Delete repo', {exact: true}).click()
  const confirmInput = page.getByPlaceholder('Name of the repository')
  await expect(confirmInput).toBeVisible({timeout: 5_000})
  await snap(page, testInfo)
  await confirmInput.fill(REPO_NAME)
  await page.getByText('Delete this repository', {exact: true}).click()
  await expect(repoRow(page)).toHaveCount(0, {timeout: 30_000})
})
