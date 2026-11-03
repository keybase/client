import type {Locator, Page, TestInfo} from '@playwright/test'
import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {withCleanup} from '@/tests/e2e/electron/helpers/cleanup'
import {deleteRepoIfPresent, repoListed, teamRepo, teamRepoChat} from '@/tests/e2e/electron/helpers/git'
import {openMenu} from '@/tests/e2e/electron/helpers/menu'
import {navigateToGit} from '@/tests/e2e/electron/helpers/navigate'
import {reloadKeepingCoverage} from '@/tests/e2e/electron/helpers/persisted'
import {step} from '@/tests/e2e/electron/helpers/step'
import {modalButton, modalRoot} from '@/tests/e2e/electron/helpers/teams'
import {E2E_CHANNELS} from '@/tests/e2e/shared/chat-data'
import * as T from '@/tests/e2e/shared/test-ids'

const SCRATCH = E2E_CHANNELS.scratch

// the page's window, as far as the check mark read uses it (the tests compile without the DOM lib)
type Win = {getComputedStyle: (e: unknown) => {opacity: string}}

// create, two settings saves (each with a list reload) and a delete, each a service round-trip
test.beforeEach(() => test.setTimeout(180_000))

const repoRow = (page: Page) => {
  const {name, team} = teamRepo()
  return page.getByTestId(T.GIT_REPO_ROW).filter({hasText: `${team}/${name}`})
}

// Opens the repo's row, which shows its clone URL, chat setting and actions.
const expandRow = async (page: Page) => {
  const row = repoRow(page)
  await expect(row, 'the team repo row').toHaveCount(1, {timeout: 30_000})
  await row.getByText(`${teamRepo().team}/${teamRepo().name}`, {exact: true}).click()
  await expect(row.getByText('Delete repo', {exact: true}), 'the expanded team repo row').toBeVisible({timeout: 10_000})
  return row
}

// The check mark of the checkbox whose label starts with `label` under `scope`: the innermost box
// holding both the label and a check mark. An unchecked box hides its mark (opacity 0).
const checkMark = (scope: Locator, label: string) => {
  const mark = scope.page().locator('.icon-gen-iconfont-check')
  return scope.locator('div').filter({has: scope.page().getByText(label)}).filter({has: mark}).last().locator(mark)
}

const announceLabel = 'Announce pushes in'
const announce = (page: Page) => repoRow(page).getByText(announceLabel, {exact: false}).first()
const announceChecked = (page: Page) => checkMark(repoRow(page), announceLabel)

// Unchecks the open modal's "Notify the team", so neither create nor delete posts to the team's
// general channel.
const uncheckNotifyTeam = async (page: Page) => {
  const label = modalRoot(page).getByText('Notify the team', {exact: true})
  const mark = checkMark(modalRoot(page), 'Notify the team')
  await expect(mark, 'the Notify the team checkbox').toHaveCount(1, {timeout: 5_000})
  // the mark fades: it is read until two reads 200ms apart agree on fully shown or hidden
  const opacity = async () => mark.evaluate(e => (globalThis as unknown as Win).getComputedStyle(e).opacity)
  let settled = ''
  await expect
    .poll(
      async () => {
        const first = await opacity()
        await page.waitForTimeout(200)
        settled = first === (await opacity()) && (first === '0' || first === '1') ? first : ''
        return settled
      },
      {message: 'the Notify the team mark settled', timeout: 5_000}
    )
    .not.toBe('')
  if (settled === '1') await label.click()
  await expect(mark, 'Notify the team unchecked').toHaveCSS('opacity', '0')
}

const reopenGit = async (page: Page) => {
  await reloadKeepingCoverage(page)
  await navigateToGit(page)
  return expandRow(page)
}

const createTeamRepo = async (page: Page, testInfo: TestInfo) => {
  const {name, team = ''} = teamRepo()
  await navigateToGit(page)
  const newTeamRepo = page.getByText('New team repository', {exact: true})
  await openMenu(page, page.getByText('New repository', {exact: true}), newTeamRepo, 'New repository')
  await newTeamRepo.click()
  const nameInput = page.getByPlaceholder('Name your repository')
  await expect(nameInput).toBeVisible({timeout: 5_000})
  const teamItem = page.getByText(team, {exact: true}).locator('visible=true').last()
  await openMenu(page, modalRoot(page).getByText('Pick a team', {exact: true}), teamItem, 'the team dropdown')
  await teamItem.click()
  // the dropdown's list closes, leaving the picked team in its box
  await expect(modalRoot(page).getByText(team, {exact: true}), 'the picked team').toHaveCount(1, {timeout: 5_000})
  await expect(modalRoot(page).getByText('Pick a team', {exact: true})).toHaveCount(0)
  await nameInput.fill(name)
  await uncheckNotifyTeam(page)
  await step(page, testInfo, 'team repo form filled', {card: true})
  await modalButton(page, 'Create').click()
  await expect(nameInput).toHaveCount(0, {timeout: 30_000})
  await expect(repoRow(page), 'the new team repo row').toHaveCount(1, {timeout: 30_000})
  await step(page, testInfo, 'team repo row')
  await expect.poll(async () => repoListed(teamRepo()), {message: 'keybase git list after Create', timeout: 30_000}).toBe(true)
}

const setTeamRepoChannel = async (page: Page, testInfo: TestInfo) => {
  await expandRow(page)
  await repoRow(page).getByText('#general', {exact: true}).click()
  const scratch = modalRoot(page).getByText(SCRATCH, {exact: true})
  await expect(scratch, `the ${SCRATCH} channel in the picker`).toBeVisible({timeout: 30_000})
  await scratch.click()
  await step(page, testInfo, 'channel picked', {card: true})
  await modalButton(page, 'Submit').click()
  await expect(scratch).toHaveCount(0, {timeout: 30_000})
  await expect.poll(async () => teamRepoChat(teamRepo()), {message: 'keybase git settings after Submit', timeout: 30_000}).toEqual({
    channel: SCRATCH,
    chatDisabled: false,
  })
  const row = await reopenGit(page)
  await expect(row.getByText(`#${SCRATCH}`, {exact: true}), 'the channel after a reload').toBeVisible({timeout: 30_000})
  await expect(announceChecked(page), 'announce checked after a reload').toHaveCSS('opacity', '1')
  await step(page, testInfo, 'channel set')
}

const turnTeamRepoChatOff = async (page: Page, testInfo: TestInfo) => {
  await announce(page).click()
  await expect.poll(async () => (await teamRepoChat(teamRepo())).chatDisabled, {message: 'keybase git settings after the uncheck', timeout: 30_000}).toBe(true)
  await reopenGit(page)
  await expect(announceChecked(page), 'announce unchecked after a reload').toHaveCSS('opacity', '0')
  await step(page, testInfo, 'chat off')
}

const deleteTeamRepo = async (page: Page, testInfo: TestInfo) => {
  const {name} = teamRepo()
  await repoRow(page).getByText('Delete repo', {exact: true}).click()
  const confirmInput = page.getByPlaceholder('Name of the repository')
  await expect(confirmInput).toBeVisible({timeout: 5_000})
  await uncheckNotifyTeam(page)
  await confirmInput.fill(name)
  await step(page, testInfo, 'delete team repo confirm', {card: true})
  await page.getByText('Delete this repository', {exact: true}).click()
  await expect(repoRow(page)).toHaveCount(0, {timeout: 30_000})
  await expect.poll(async () => repoListed(teamRepo()), {message: 'keybase git list after the delete', timeout: 30_000}).toBe(false)
  await step(page, testInfo, 'team repo gone')
}

test('create a team repo, set its chat channel, delete it', async ({page}, testInfo) => {
  await withCleanup(
    async () => {
      await createTeamRepo(page, testInfo)
      await setTeamRepoChannel(page, testInfo)
      await turnTeamRepoChatOff(page, testInfo)
      await deleteTeamRepo(page, testInfo)
    },
    [async () => deleteRepoIfPresent(teamRepo())]
  )
})
