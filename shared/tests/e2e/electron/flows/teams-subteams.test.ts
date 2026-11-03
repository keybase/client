// A subteam of the e2e team made, renamed and deleted from the app. The new-subteam wizard is opened
// only from the e2e team's own Subteams tab, so its name is fixed under KB_E2E_TEAM; it is submitted
// only once the name it shows is exactly this run's stamped name.
import type {Page} from '@playwright/test'
import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {loadE2EAccounts} from '@/tests/e2e/accounts/env'
import {withCleanup} from '@/tests/e2e/electron/helpers/cleanup'
import {closeLeftoverModals} from '@/tests/e2e/electron/helpers/modal'
import {openE2ESubteam, openE2ETeam} from '@/tests/e2e/electron/helpers/navigate'
import {step} from '@/tests/e2e/electron/helpers/step'
import {
  deleteSubteamIfPresent,
  freshSubteamPart,
  modalButton,
  modalRoot,
  pickFromTeamMenu,
  requireThisRunSubteam,
  subteamExists,
} from '@/tests/e2e/electron/helpers/teams'
import * as T from '@/tests/e2e/shared/test-ids'

test.use({actionTimeout: 10_000})

test.beforeEach(async ({page}) => {
  await closeLeftoverModals(page)
})
test.afterEach(async ({page}) => {
  await closeLeftoverModals(page)
})

const subteamRow = (page: Page, name: string) =>
  page.getByTestId(T.TEAMS_SUBTEAMS_TAB).getByText(name, {exact: true}).locator('visible=true').first()

test('create, rename and delete a subteam', async ({page}, testInfo) => {
  test.setTimeout(300_000)
  const {team} = loadE2EAccounts()
  const name = `${team}.${freshSubteamPart('sub')}`
  const renamed = `${team}.${freshSubteamPart('ren')}`
  requireThisRunSubteam(name)
  requireThisRunSubteam(renamed)
  await withCleanup(async () => {
    await openE2ETeam(page)
    await page.getByTestId(T.TEAMS_TAB_SUBTEAMS_BUTTON).locator('visible=true').first().click()
    await page.getByTestId(T.TEAMS_SUBTEAMS_TAB).getByText('Create subteam', {exact: true}).click()
    const nameInput = modalRoot(page).getByPlaceholder('subteam')
    await expect(nameInput).toBeVisible({timeout: 10_000})
    await nameInput.fill(name.slice(team.length + 1))
    // the wizard was opened from the e2e team's own Subteams tab: the name is fixed under it
    await expect(modalRoot(page).getByText(`${team}.`, {exact: true}), 'the parent prefix').toBeVisible()
    await expect(nameInput).toHaveValue(name.slice(team.length + 1))
    await step(page, testInfo, 'subteam name')
    await modalButton(page, 'Continue').click()
    // the avatar step, then the parent's members to bring along: none
    await expect(page.getByText('Upload avatar', {exact: true}).locator('visible=true').first()).toBeVisible({timeout: 10_000})
    await page.getByText('Skip', {exact: true}).locator('visible=true').last().click()
    await modalButton(page, 'Continue without members').click()
    await expect(page.getByText('Where will your first team members come from?', {exact: true})).toBeVisible({timeout: 10_000})
    // where the first members come from: skipped, which creates the subteam. The full name the
    // wizard will create is the one it carries; checked before the press
    const skip = page.getByText('Skip', {exact: true}).locator('visible=true').last()
    await expect(skip).toBeVisible({timeout: 10_000})
    // the full name the wizard is about to create, in its header
    await expect(page.getByText(name, {exact: true}).locator('visible=true').first(), 'the name the wizard will create').toBeVisible()
    requireThisRunSubteam(name)
    await step(page, testInfo, 'about to create')
    await skip.click()
    await expect.poll(async () => subteamExists(name), {message: 'the subteam the wizard created', timeout: 30_000}).toBe(true)
    await step(page, testInfo, 'subteam created')

    await openE2ESubteam(page, name, 'the new subteam')
    await page.getByText('Edit', {exact: true}).locator('visible=true').first().click()
    const leaf = modalRoot(page).getByPlaceholder('subteam')
    await expect(leaf).toHaveValue(name.slice(team.length + 1), {timeout: 10_000})
    await leaf.fill(renamed.slice(team.length + 1))
    requireThisRunSubteam(renamed)
    await modalButton(page, 'Save').click()
    await expect
      .poll(async () => (await subteamExists(renamed)) && !(await subteamExists(name)), {message: 'the subteam under its new name', timeout: 30_000})
      .toBe(true)
    await step(page, testInfo, 'renamed')
    // the modal closes itself only when it sees the save in flight, which a quick save can finish
    // before it looks (an owner-report finding): it is closed here when it stayed
    await closeLeftoverModals(page)

    await openE2ESubteam(page, renamed, 'the renamed subteam')
    requireThisRunSubteam(renamed)
    await pickFromTeamMenu(page, 'Delete team')
    const prompt = page.getByText(`Delete ${renamed}?`, {exact: true})
    await expect(prompt).toBeVisible({timeout: 10_000})
    for (const label of ['Team chats will be lost', 'Data in the team folder will be lost', 'Team members will be notified']) {
      await page.getByText(label, {exact: true}).click()
    }
    await step(page, testInfo, 'delete confirm')
    await page.locator('.button--type-Danger:visible', {hasText: 'Delete team'}).click()
    await expect(prompt).toHaveCount(0, {timeout: 30_000})
    await expect.poll(async () => subteamExists(renamed), {message: 'the subteam after Delete team', timeout: 30_000}).toBe(false)
    await openE2ETeam(page)
    await page.getByTestId(T.TEAMS_TAB_SUBTEAMS_BUTTON).locator('visible=true').first().click()
    await expect(page.getByTestId(T.TEAMS_SUBTEAMS_TAB).getByText('Create subteam', {exact: true}), 'the subteams tab').toBeVisible()
    await expect(subteamRow(page, renamed)).toHaveCount(0, {timeout: 20_000})
    await step(page, testInfo, 'subteam gone')
  }, [async () => deleteSubteamIfPresent(name), async () => deleteSubteamIfPresent(renamed)])
})
