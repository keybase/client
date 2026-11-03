import type {Page, TestInfo} from '@playwright/test'
import {test, expect, e2eRunId} from '@/tests/e2e/electron/helpers/fixtures'
import {navigateToGit} from '@/tests/e2e/electron/helpers/navigate'
import {openMenu} from '@/tests/e2e/electron/helpers/menu'
import {step} from '@/tests/e2e/electron/helpers/step'
import * as T from '@/tests/e2e/shared/test-ids'
import {closeModal} from '@/tests/e2e/electron/helpers/modal'

// Full create → delete cycle on a personal repo named for the run, so the sweeper clears one a
// crashed run leaves. The delete test makes the repo when an earlier test did not.
const REPO_NAME = `e2e-${e2eRunId()}-repo`

// repo create/delete RPCs can outlive the default 15s test timeout
test.beforeEach(() => test.setTimeout(60_000))

function repoRow(page: Page) {
  return page.getByTestId(T.GIT_REPO_ROW).filter({hasText: REPO_NAME})
}

const newPersonalRepo = (page: Page) => page.getByText('New personal repository', {exact: true})

async function openNewRepoModal(page: Page) {
  await openMenu(page, page.getByText('New repository', {exact: true}), newPersonalRepo(page), 'New repository')
  await newPersonalRepo(page).click()
  const nameInput = page.getByPlaceholder('Name your repository')
  await expect(nameInput).toBeVisible({timeout: 5_000})
  return nameInput
}

// Once the modal (whose title is the item's label) is gone, the pick has closed the menu too, so
// the next click on the button opens it.
const expectMenuClosed = async (page: Page) =>
  expect(newPersonalRepo(page), 'the New repository menu to be closed').toHaveCount(0, {timeout: 5_000})

// Creates the run's repo unless it is there already (a retry of the test that made it).
async function ensureRepo(page: Page, testInfo: TestInfo) {
  // the list has loaded once it shows a row (the account holds other repos)
  await expect(page.getByTestId(T.GIT_REPO_ROW).first(), 'the git repo list to load').toBeVisible({timeout: 10_000})
  if ((await repoRow(page).count()) > 0) return
  const nameInput = await openNewRepoModal(page)
  await nameInput.fill(REPO_NAME)
  await step(page, testInfo, 'repo name typed')
  await page.getByText('Create', {exact: true}).click()
  await expect(repoRow(page).first()).toBeVisible({timeout: 30_000})
  await expectMenuClosed(page)
}

test('new repo modal opens', async ({page}, testInfo) => {
  await navigateToGit(page)
  await step(page, testInfo, 'git page')
  const nameInput = await openNewRepoModal(page)
  await step(page, testInfo, 'new repo modal', {card: true})
  await closeModal(page)
  await expect(nameInput).not.toBeVisible({timeout: 5_000})
  await expectMenuClosed(page)
  await step(page, testInfo, 'modal closed')
})

test('created repo row renders', async ({page}, testInfo) => {
  await navigateToGit(page)
  await ensureRepo(page, testInfo)
  await step(page, testInfo, 'repo row in list', {card: true})
})

test('delete repo confirm renders, then repo is deleted', async ({page}, testInfo) => {
  await navigateToGit(page)
  await ensureRepo(page, testInfo)
  await repoRow(page).first().click()
  await step(page, testInfo, 'repo opened')
  await page.getByText('Delete repo', {exact: true}).click()
  const confirmInput = page.getByPlaceholder('Name of the repository')
  await expect(confirmInput).toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'delete repo confirm', {card: true})
  await confirmInput.fill(REPO_NAME)
  await step(page, testInfo, 'repo name typed')
  await page.getByText('Delete this repository', {exact: true}).click()
  await expect(repoRow(page)).toHaveCount(0, {timeout: 30_000})
  await step(page, testInfo, 'repo gone')
})
