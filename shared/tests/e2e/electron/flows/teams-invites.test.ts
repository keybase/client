// Invites to a subteam from the app: an email invite (to a reserved example.com address, cancelled
// again in the same test), the second account joining with an invite link, and a request to join
// that is denied. Each test makes its own subteam of the e2e team and deletes it after, which takes
// any membership, invite or request with it.
import type {Page} from '@playwright/test'
import {test, expect, e2eRunId} from '@/tests/e2e/electron/helpers/fixtures'
import {loadE2EAccounts, loadE2EEnv} from '@/tests/e2e/accounts/env'
import {asSecond, restoreToSmoke, RESTORE_WORST_MS} from '@/tests/e2e/electron/helpers/accounts'
import {clickUnoccluded} from '@/tests/e2e/electron/helpers/chat'
import {withCleanup} from '@/tests/e2e/electron/helpers/cleanup'
import {openMenu} from '@/tests/e2e/electron/helpers/menu'
import {closeLeftoverModals} from '@/tests/e2e/electron/helpers/modal'
import {navigateToChat, navigateToTeams} from '@/tests/e2e/electron/helpers/navigate'
import {step} from '@/tests/e2e/electron/helpers/step'
import {
  deleteSubteamIfPresent,
  inviteNames,
  makeSubteam,
  memberRoles,
  menuItem,
  modalButton,
  modalRoot,
  openSubteamTab,
  readBack,
  requireThisRunSubteam,
  rowMenuButton,
} from '@/tests/e2e/electron/helpers/teams'
import {ensurePeer, runKeybase} from '@/tests/e2e/shared/peer-service'
import * as T from '@/tests/e2e/shared/test-ids'

test.use({actionTimeout: 10_000})

test.beforeEach(async ({page}) => {
  await closeLeftoverModals(page)
})
test.afterEach(async ({page}) => {
  test.setTimeout(test.info().timeout + RESTORE_WORST_MS)
  await closeLeftoverModals(page)
  await restoreToSmoke(page)
})

const roleOf = async (subteam: string, username: string) => (await memberRoles(subteam))[username] ?? 'none'

const memberList = (page: Page) => page.getByTestId(T.TEAMS_MEMBER_LIST).locator('visible=true').first()

test('invite by email', async ({page}, testInfo) => {
  test.setTimeout(240_000)
  const email = `e2e-${e2eRunId()}-inv@example.com`
  const {name} = await makeSubteam('eml')
  await withCleanup(async () => {
    await openSubteamTab(page, name, T.TEAMS_TAB_MEMBERS_BUTTON)
    await page.getByText('Add/Invite people', {exact: true}).locator('visible=true').first().click()
    await modalRoot(page).getByText('A list of email addresses', {exact: true}).click()
    const input = modalRoot(page).getByPlaceholder('Email addresses')
    await expect(input).toBeVisible({timeout: 10_000})
    await input.fill(email)
    await modalButton(page, 'Continue').click()
    const finish = modalButton(page, 'Invite 1 person & finish')
    await expect(finish).toBeVisible({timeout: 15_000})
    await expect(modalRoot(page).getByText(email, {exact: true}), 'the address to invite').toBeVisible()
    await step(page, testInfo, 'email invite')
    await finish.click()
    await expect.poll(async () => inviteNames(name), {message: 'the subteam invites after the email invite', timeout: 30_000}).toContain(email)
    const row = memberList(page).getByText(email, {exact: true}).first()
    await expect(row, 'the email invite in the subteam invitations').toBeVisible({timeout: 20_000})
    await step(page, testInfo, 'invite listed')

    const cancel = menuItem(page, 'Cancel invite')
    await row.hover()
    await openMenu(page, rowMenuButton(memberList(page), email), cancel, 'the invite menu')
    await cancel.click()
    await expect.poll(async () => inviteNames(name), {message: 'the subteam invites after Cancel invite', timeout: 30_000}).not.toContain(email)
    await expect(memberList(page).getByText(email, {exact: true})).toHaveCount(0, {timeout: 20_000})
    await step(page, testInfo, 'invite cancelled')
  }, [async () => deleteSubteamIfPresent(name)])
})

test('invite link, second joins', async ({page}, testInfo) => {
  test.setTimeout(300_000)
  const {secondUser} = loadE2EAccounts()
  const {name} = await makeSubteam('lnk')
  await withCleanup(async () => {
    requireThisRunSubteam(name)
    // the desktop app has no screen that makes an invite link (that is the phone's contact invite):
    // the CLI makes one, for one use, and the app joins with it
    const out = await runKeybase(['team', 'generate-invitelink', name, '--role', 'reader', '--max-uses', '1', '--duration', '1D'], {timeoutMs: 60_000})
    const link = /Generated link: (\S+?)\.?\n/.exec(`${out}\n`)?.[1]
    if (!link) throw new Error('generate-invitelink printed no link')
    expect(await roleOf(name, secondUser), 'the second account before it joins').toBe('none')
    await asSecond(page, async () => {
      await navigateToTeams(page)
      await page.getByText('Join a team', {exact: true}).locator('visible=true').first().click()
      const input = modalRoot(page).getByPlaceholder('Token or team name')
      await expect(input).toBeVisible({timeout: 10_000})
      await input.fill(link)
      await step(page, testInfo, 'link pasted')
      await modalButton(page, 'Continue').click()
      const join = modalRoot(page).locator('.button--primary', {hasText: 'Join team'}).locator('visible=true').last()
      await expect(join, 'the invite link screen').toBeVisible({timeout: 20_000})
      await expect(modalRoot(page).getByText(name, {exact: false}).first(), 'the invite is to the subteam').toBeVisible()
      await step(page, testInfo, 'join from invite')
      await clickUnoccluded(join)
      await expect(join).toHaveCount(0, {timeout: 20_000})
      await closeLeftoverModals(page)
      // the account switcher is reached from the chat tab's header
      await navigateToChat(page)
    })
    await expect.poll(async () => roleOf(name, secondUser), {message: 'the second account after joining by link', timeout: 30_000}).toBe('reader')
    await openSubteamTab(page, name, T.TEAMS_TAB_MEMBERS_BUTTON)
    await expect(memberList(page).getByText(secondUser, {exact: true}).first(), "the second account in the subteam's members").toBeVisible({
      timeout: 20_000,
    })
    await step(page, testInfo, 'second joined')
  }, [
    async () => restoreToSmoke(page),
    async () => {
      await deleteSubteamIfPresent(name)
      expect(await secondSubteamsOfThisRun(), 'subteams of this run the second account is in').toEqual([])
    },
  ])
})

// The subteams of the e2e team made by this run that the second account is in, read on its peer.
const secondSubteamsOfThisRun = async () => {
  const {team} = loadE2EAccounts()
  const peer = await ensurePeer('second', loadE2EEnv())
  const out = await peer.cli(['team', 'list-memberships', '-j'], 60_000)
  const teams = (JSON.parse(out) as {teams?: Array<{fq_name: string}> | null}).teams ?? []
  return teams.map(t => t.fq_name).filter(n => n.startsWith(`${team}.e2e${e2eRunId()}`))
}

test('ignore a request', async ({page}, testInfo) => {
  test.setTimeout(240_000)
  const {secondUser} = loadE2EAccounts()
  const {name} = await makeSubteam('req')
  await withCleanup(async () => {
    requireThisRunSubteam(name)
    const peer = await ensurePeer('second', loadE2EEnv())
    await peer.cli(['team', 'request-access', name], 60_000)
    await expect.poll(async () => requesters(name), {message: 'the requests to join the subteam', timeout: 30_000}).toContain(secondUser)
    await openSubteamTab(page, name, T.TEAMS_TAB_MEMBERS_BUTTON)
    const row = memberList(page).getByText(secondUser, {exact: true}).first()
    await expect(row, "the second account's request").toBeVisible({timeout: 20_000})
    await step(page, testInfo, 'request listed')
    const deny = menuItem(page, 'Deny')
    await openMenu(page, rowMenuButton(memberList(page), secondUser), deny, 'the request menu')
    await deny.click()
    await expect.poll(async () => requesters(name), {message: 'the requests after Deny', timeout: 30_000}).not.toContain(secondUser)
    await expect(memberList(page).getByText(secondUser, {exact: true})).toHaveCount(0, {timeout: 20_000})
    expect(await roleOf(name, secondUser), 'the second account was not let in').toBe('none')
    await step(page, testInfo, 'request denied')
  }, [async () => deleteSubteamIfPresent(name)])
})

// The usernames with a request to join a team, read through the CLI.
const requesters = async (name: string) => {
  const out = await readBack(async () => runKeybase(['team', 'list-requests', '--team', name, '-j'], {timeoutMs: 60_000}))
  const reqs = (JSON.parse(out || '[]') as Array<{username: string}> | null) ?? []
  return reqs.map(r => r.username)
}
