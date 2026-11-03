import type {Page, TestInfo} from '@playwright/test'
import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {withCleanup} from '@/tests/e2e/electron/helpers/cleanup'
import {deleteRepoIfPresent, personalRepo, repoListed, repoUrl} from '@/tests/e2e/electron/helpers/git'
import {connectMainProcess} from '@/tests/e2e/electron/helpers/main-process'
import {navigateToGit} from '@/tests/e2e/electron/helpers/navigate'
import {openMenu} from '@/tests/e2e/electron/helpers/menu'
import {reloadKeepingCoverage} from '@/tests/e2e/electron/helpers/persisted'
import {step} from '@/tests/e2e/electron/helpers/step'
import * as T from '@/tests/e2e/shared/test-ids'
import {closeModal} from '@/tests/e2e/electron/helpers/modal'

// Full create → delete cycle on a personal repo named for the run, so the sweeper clears one a
// crashed run leaves. The delete test makes the repo when an earlier test did not.
const REPO_NAME = personalRepo().name

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

// Creates the run's repo unless the service lists it already (an earlier test made it). The service
// decides. A cleanup's CLI delete leaves a stale row up until the app reloads, so the app is
// reloaded when its list and the service disagree about the run's row.
async function ensureRepo(page: Page, testInfo: TestInfo) {
  const openList = async () => {
    await navigateToGit(page)
    // the list has loaded once it shows a row (the account holds other repos)
    await expect(page.getByTestId(T.GIT_REPO_ROW).first(), 'the git repo list to load').toBeVisible({timeout: 10_000})
  }
  await openList()
  const listed = await repoListed(personalRepo())
  if ((await repoRow(page).count()) > 0 !== listed) {
    await reloadKeepingCoverage(page)
    await openList()
  }
  if (!listed) {
    const nameInput = await openNewRepoModal(page)
    await nameInput.fill(REPO_NAME)
    await step(page, testInfo, 'repo name typed')
    await page.getByText('Create', {exact: true}).click()
    await expect(nameInput, 'the new repo modal to close on Create').toHaveCount(0, {timeout: 30_000})
    await expectMenuClosed(page)
    await expect.poll(async () => repoListed(personalRepo()), {message: 'keybase git list after Create', timeout: 30_000}).toBe(true)
  }
  await expect(repoRow(page).first()).toBeVisible({timeout: 30_000})
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

test('copy the clone URL', async ({page}, testInfo) => {
  const url = repoUrl(personalRepo())
  await withCleanup(
    async () => {
      await navigateToGit(page)
      await ensureRepo(page, testInfo)
      await repoRow(page).first().getByText(REPO_NAME, {exact: true}).click()
      await expect(repoRow(page).getByText(url, {exact: true}), 'the clone URL').toBeVisible({timeout: 10_000})
      const main = await connectMainProcess()
      expect(await main.clipboardText(), 'the clipboard before the copy').not.toBe(url)
      await repoRow(page).locator('.icon-gen-iconfont-clipboard').click()
      await expect.poll(async () => main.clipboardText(), {message: 'the clipboard after the copy', timeout: 5_000}).toBe(url)
      await step(page, testInfo, 'clone URL copied', {card: true})
    },
    [async () => deleteRepoIfPresent(personalRepo())]
  )
})

test('delete repo confirm renders, then repo is deleted', async ({page}, testInfo) => {
  await withCleanup(
    async () => {
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
      await expect.poll(async () => repoListed(personalRepo()), {message: 'keybase git list after the delete', timeout: 30_000}).toBe(false)
      await step(page, testInfo, 'repo gone')
    },
    [async () => deleteRepoIfPresent(personalRepo())]
  )
})
