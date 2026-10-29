// A subteam's members changed from the app: the second account added from its profile and through
// the add-members wizard, its role changed, added to and removed from channels, kicked out, leaving
// on its own, and dismissing the invitation to block the account that added it. Each test makes its
// own subteam of the e2e team, reads every change back through the CLI, and deletes the subteam
// after, which takes the second account's membership with it.
import type {Page} from '@playwright/test'
import {test, expect, e2eRunId} from '@/tests/e2e/electron/helpers/fixtures'
import {loadE2EAccounts} from '@/tests/e2e/accounts/env'
import {stampedChannelName} from '@/tests/e2e/accounts/run-id'
import {asSecond, restoreToSmoke, RESTORE_WORST_MS} from '@/tests/e2e/electron/helpers/accounts'
import {clickUnoccluded, openSmallTeamWithRetries, openUserProfile, watchOutgoingRpcs} from '@/tests/e2e/electron/helpers/chat'
import {withCleanup} from '@/tests/e2e/electron/helpers/cleanup'
import {openMenu} from '@/tests/e2e/electron/helpers/menu'
import {closeLeftoverModals} from '@/tests/e2e/electron/helpers/modal'
import {navigateToChat, openE2ESubteamFromList} from '@/tests/e2e/electron/helpers/navigate'
import {reloadKeepingCoverage} from '@/tests/e2e/electron/helpers/persisted'
import {step} from '@/tests/e2e/electron/helpers/step'
import {
  addToSubteamFromCli,
  checkedRowNames,
  channelMembers,
  confirmDanger,
  deleteSubteamIfPresent,
  makeSubteam,
  makeSubteamChannel,
  memberRoles,
  menuItem,
  modalButton,
  modalRoot,
  openSubteamTab,
  pickFromTeamMenu,
  pickRole,
  requireThisRunSubteam,
  runChatApi,
  teamID,
} from '@/tests/e2e/electron/helpers/teams'
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

const memberRow = (page: Page, username: string) =>
  page.getByTestId(T.TEAMS_MEMBER_LIST).getByText(username, {exact: true}).locator('visible=true').first()

// The second account's member page in a subteam, from the subteam's Members tab.
const openMemberPage = async (page: Page, subteam: string, username: string) => {
  await openSubteamTab(page, subteam, T.TEAMS_TAB_MEMBERS_BUTTON)
  await expect(memberRow(page, username), `${username} in the subteam's members`).toBeVisible({timeout: 15_000})
  await memberRow(page, username).click()
  await expect(page.getByTestId(T.TEAMS_MEMBER_PAGE).locator('visible=true').first()).toBeVisible({timeout: 10_000})
}

// On a member page, the subteam's own row, expanded to show its actions. The page lists every team
// of the tree the member is in, the e2e team too, so everything is looked for inside this row.
const expandSubteamRow = async (page: Page, subteam: string) => {
  requireThisRunSubteam(subteam)
  const memberPage = page.getByTestId(T.TEAMS_MEMBER_PAGE).locator('visible=true').first()
  // the innermost element holding both the subteam's name and an expand caret: its row
  const row = memberPage
    .locator('div')
    .filter({has: page.getByText(subteam, {exact: true})})
    .filter({has: page.getByTestId(T.TEAMS_MEMBER_TEAM_EXPAND)})
    .last()
  await expect(row, 'the subteam on the member page').toBeVisible({timeout: 15_000})
  await expect(row.getByTestId(T.TEAMS_MEMBER_TEAM_EXPAND), "the subteam row's own caret").toHaveCount(1)
  await clickUnoccluded(row.getByTestId(T.TEAMS_MEMBER_TEAM_EXPAND))
  await expect(row.getByTestId(T.TEAMS_MEMBER_TEAM_ACTIVITY), 'the subteam row expanded').toBeVisible({timeout: 5_000})
  return row
}

test('add second from their profile', async ({page}, testInfo) => {
  test.setTimeout(240_000)
  const {secondUser} = loadE2EAccounts()
  const {name} = await makeSubteam('prf')
  await withCleanup(async () => {
    expect(await roleOf(name, secondUser), 'the second account in a new subteam').toBe('none')
    // the modal finds the picked team's id in the app's teams list, which a subteam made through
    // the CLI does not reach until the list loads again: a reload loads it, and the teams tab shows
    // the subteam before the profile is opened
    await reloadKeepingCoverage(page)
    await openE2ESubteamFromList(page, name, 'the subteam this test made')
    await openUserProfile(page, secondUser)
    const add = menuItem(page, 'Add to team...')
    await openMenu(page, page.getByTestId(T.PROFILE_PAGE).locator('visible=true').first().locator('.icon-gen-iconfont-ellipsis').first(), add, 'the profile menu')
    await add.click()
    const row = modalRoot(page).getByText(name, {exact: true})
    await expect(row, 'the subteam among the teams to add to').toBeAttached({timeout: 15_000})
    await row.scrollIntoViewIfNeeded()
    await clickUnoccluded(row)
    // the smoke account is in teams that are not the tests' to change: the subteam alone is picked
    await expect.poll(async () => checkedRowNames(modalRoot(page)), {message: 'the teams picked', timeout: 5_000}).toEqual([name])
    await step(page, testInfo, 'subteam picked')
    await modalButton(page, 'Add to team').click()
    await expect.poll(async () => roleOf(name, secondUser), {message: "the second account's role after Add to team", timeout: 30_000}).toBe('writer')
    await openSubteamTab(page, name, T.TEAMS_TAB_MEMBERS_BUTTON)
    await expect(memberRow(page, secondUser), "the second account in the subteam's members").toBeVisible({timeout: 15_000})
    await step(page, testInfo, 'second added')
  }, [async () => deleteSubteamIfPresent(name)])
})

test('add members wizard', async ({page}, testInfo) => {
  test.setTimeout(240_000)
  const {secondUser} = loadE2EAccounts()
  const {name} = await makeSubteam('wiz')
  await withCleanup(async () => {
    await openSubteamTab(page, name, T.TEAMS_TAB_MEMBERS_BUTTON)
    await page.getByText('Add/Invite people', {exact: true}).locator('visible=true').first().click()
    await modalRoot(page).getByText('From Keybase', {exact: true}).click()
    const search = modalRoot(page).getByPlaceholder(/^Search/).locator('visible=true').first()
    await expect(search).toBeVisible({timeout: 10_000})
    await search.fill(secondUser)
    const result = page.getByTestId(T.TEAM_BUILDING_RESULT_ROW).filter({has: page.getByText(secondUser, {exact: true})}).first()
    await expect(result, 'the second account in the search').toBeVisible({timeout: 15_000})
    await clickUnoccluded(result)
    await page.getByText('Add', {exact: true}).locator('visible=true').last().click()
    const finish = modalButton(page, 'Invite 1 person & finish')
    await expect(finish).toBeVisible({timeout: 10_000})
    await modalRoot(page).locator(':text-is("Invite as:") + *').first().click()
    await pickRole(page, 'Reader')
    await step(page, testInfo, 'second as reader')
    await finish.click()
    await expect.poll(async () => roleOf(name, secondUser), {message: "the second account's role after the wizard", timeout: 30_000}).toBe('reader')
    await step(page, testInfo, 'second added as reader')
  }, [async () => deleteSubteamIfPresent(name)])
})

test('change role', async ({page}, testInfo) => {
  test.setTimeout(240_000)
  const {secondUser} = loadE2EAccounts()
  const {name} = await makeSubteam('rol')
  await withCleanup(async () => {
    await addToSubteamFromCli(name, secondUser, 'reader')
    await openMemberPage(page, name, secondUser)
    const row = await expandSubteamRow(page, name)
    await row.getByText('Reader', {exact: true}).click()
    await pickRole(page, 'Writer')
    await expect.poll(async () => roleOf(name, secondUser), {message: "the second account's role after Save", timeout: 30_000}).toBe('writer')
    await step(page, testInfo, 'second is a writer')
  }, [async () => deleteSubteamIfPresent(name)])
})

test('add second to several channels', async ({page}, testInfo) => {
  test.setTimeout(240_000)
  const {secondUser} = loadE2EAccounts()
  const {name} = await makeSubteam('chs')
  const channels = [stampedChannelName('mch1', e2eRunId()), stampedChannelName('mch2', e2eRunId())]
  await withCleanup(async () => {
    for (const c of channels) await makeSubteamChannel(name, c)
    await addToSubteamFromCli(name, secondUser, 'writer')
    for (const c of channels) expect(await channelMembers(name, c), `#${c} before`).not.toContain(secondUser)
    await openMemberPage(page, name, secondUser)
    const row = await expandSubteamRow(page, name)
    await row.getByText('Add to channels', {exact: true}).click()
    for (const c of channels) await clickUnoccluded(modalRoot(page).getByText(`#${c}`, {exact: true}))
    await step(page, testInfo, 'channels picked')
    await modalButton(page, 'Add to 2 channels').click()
    for (const c of channels) {
      await expect.poll(async () => channelMembers(name, c), {message: `#${c} members after Add`, timeout: 30_000}).toContain(secondUser)
    }
    await step(page, testInfo, 'second in both channels')
  }, [async () => deleteSubteamIfPresent(name)])
})

test('remove from a channel', async ({page}, testInfo) => {
  test.setTimeout(240_000)
  const {secondUser} = loadE2EAccounts()
  const {name} = await makeSubteam('rmc')
  const channel = stampedChannelName('rmc', e2eRunId())
  await withCleanup(async () => {
    await makeSubteamChannel(name, channel)
    await addToSubteamFromCli(name, secondUser, 'writer')
    await runChatApi('addtochannel', {channel: {members_type: 'team', name, topic_name: channel}, usernames: [secondUser]})
    await expect.poll(async () => channelMembers(name, channel), {message: `#${channel} with the second account`, timeout: 30_000}).toContain(secondUser)
    await openSubteamTab(page, name, T.TEAMS_TAB_CHANNELS_BUTTON)
    await page.getByTestId(T.TEAMS_CHANNEL_LIST).getByText(`#${channel}`, {exact: true}).locator('visible=true').first().click()
    const channelPage = page.getByTestId(T.TEAMS_CHANNEL_PAGE).locator('visible=true').first()
    await expect(channelPage).toBeVisible({timeout: 10_000})
    const row = channelPage.getByText(secondUser, {exact: true}).first()
    await expect(row, "the second account in the channel's members").toBeVisible({timeout: 15_000})
    await row.hover()
    await clickUnoccluded(channelPage.locator(`[data-testid="${T.TEAMS_MEMBER_CHECK}"]:left-of(:text-is("${secondUser}"))`).first())
    const popup = page.getByTestId(T.TEAMS_SELECTION_POPUP).locator('visible=true').first()
    await expect(popup).toBeVisible({timeout: 10_000})
    await popup.getByText('Remove from channel', {exact: true}).click()
    await expect(page.getByText(`Remove ${secondUser} from #${channel}?`, {exact: true})).toBeVisible({timeout: 10_000})
    await step(page, testInfo, 'remove confirm')
    await confirmDanger(page, 'Remove from channel')
    await expect.poll(async () => channelMembers(name, channel), {message: `#${channel} after Remove`, timeout: 30_000}).not.toContain(secondUser)
    expect(await roleOf(name, secondUser), 'still in the subteam').toBe('writer')
    await step(page, testInfo, 'removed from the channel')
  }, [async () => deleteSubteamIfPresent(name)])
})

test('remove member', async ({page}, testInfo) => {
  test.setTimeout(240_000)
  const {secondUser} = loadE2EAccounts()
  const {name} = await makeSubteam('kck')
  await withCleanup(async () => {
    await addToSubteamFromCli(name, secondUser, 'writer')
    await openSubteamTab(page, name, T.TEAMS_TAB_MEMBERS_BUTTON)
    await expect(memberRow(page, secondUser), "the second account in the subteam's members").toBeVisible({timeout: 15_000})
    await memberRow(page, secondUser).hover()
    await clickUnoccluded(page.getByTestId(T.TEAMS_MEMBER_LIST).locator(`[data-testid="${T.TEAMS_MEMBER_CHECK}"]:left-of(:text-is("${secondUser}"))`).first())
    const popup = page.getByTestId(T.TEAMS_SELECTION_POPUP).locator('visible=true').first()
    await expect(popup).toBeVisible({timeout: 10_000})
    await popup.getByText('Remove from team', {exact: true}).click()
    await expect(page.getByText(`Kick ${secondUser} out of ${name}?`, {exact: true})).toBeVisible({timeout: 10_000})
    await step(page, testInfo, 'kick out confirm')
    await confirmDanger(page, 'Kick out')
    await expect(page.getByText(`Kick ${secondUser} out of ${name}?`, {exact: true}), 'the kick out confirm after Kick out').toHaveCount(0, {timeout: 20_000})
    await expect.poll(async () => roleOf(name, secondUser), {message: "the second account's role after Kick out", timeout: 30_000}).toBe('none')
    await step(page, testInfo, 'second kicked out')
  }, [async () => deleteSubteamIfPresent(name)])
})

test('second leaves', async ({page}, testInfo) => {
  test.setTimeout(300_000)
  const {secondUser} = loadE2EAccounts()
  const {name} = await makeSubteam('lve')
  await withCleanup(async () => {
    await addToSubteamFromCli(name, secondUser, 'writer')
    await asSecond(page, async () => {
      await openE2ESubteamFromList(page, name, 'the subteam second was added to')
      await pickFromTeamMenu(page, 'Leave team')
      await expect(page.getByText(`Leave ${name}?`, {exact: true})).toBeVisible({timeout: 10_000})
      // leaving never blocks the team: its checkbox stays off
      expect(await checkedRowNames(modalRoot(page)), 'the checked boxes in the leave modal').toEqual([])
      await step(page, testInfo, 'really leave')
      await confirmDanger(page, 'Leave team')
      await expect(page.getByText(`Leave ${name}?`, {exact: true})).toHaveCount(0, {timeout: 20_000})
      // the account switcher is reached from the chat tab's header
      await navigateToChat(page)
    })
    await expect.poll(async () => roleOf(name, secondUser), {message: "the second account's role after it left", timeout: 30_000}).toBe('none')
    await step(page, testInfo, 'second left')
  }, [async () => restoreToSmoke(page), async () => deleteSubteamIfPresent(name)])
})

// What the app's block buttons store holds for a team, once it has read the service's state: the
// row is drawn from it, so an absent row means something only after this says loaded.
const blockButtonsState = async (page: Page, id: string) =>
  page.evaluate(async tid => {
    type S = {blockButtonsMap: ReadonlyMap<string, unknown>; loaded: boolean}
    const mod = (await import('/chat/blocking/block-buttons-state.tsx' as string)) as {useBlockButtonsState: {getState: () => S}}
    const s = mod.useBlockButtonsState.getState()
    return {loaded: s.loaded, shown: s.blockButtonsMap.has(tid)}
  }, id)

test('second dismisses the invitation to block its adder', async ({page}, testInfo) => {
  test.setTimeout(300_000)
  const {secondUser} = loadE2EAccounts()
  const {name} = await makeSubteam('ibk')
  await withCleanup(async () => {
    const id = await teamID(name)
    // added without the chat message, so second has nothing of its own in the thread, which would
    // dismiss the buttons on its own
    await addToSubteamFromCli(name, secondUser, 'writer')
    await asSecond(page, async () => {
      await openSmallTeamWithRetries(page, name)
      const row = page.getByTestId(T.CHAT_BLOCK_BUTTONS).locator('visible=true')
      await expect(row, 'the invitation-to-block row in the subteam second was added to').toBeVisible({timeout: 30_000})
      await expect(row.getByText(/ added you to this team\.$/), "the row names second's adder").toBeVisible()
      await step(page, testInfo, 'block buttons shown')
      const rpcs = await watchOutgoingRpcs(page)
      try {
        await clickUnoccluded(row.getByTestId(T.CHAT_BLOCK_BUTTONS_DISMISS))
        await expect
          .poll(() => rpcs.seen().filter(c => c.method === 'keybase.1.user.dismissBlockButtons' && c.params.includes(id)).length, {
            message: "the dismiss sent dismissBlockButtons for the subteam's id",
            timeout: 5_000,
          })
          .toBe(1)
      } finally {
        await rpcs.stop()
      }
      await expect(page.getByTestId(T.CHAT_BLOCK_BUTTONS), 'the row after the dismiss').toHaveCount(0, {timeout: 15_000})
      await step(page, testInfo, 'block buttons dismissed')
      // a reload reads the service's state again
      await reloadKeepingCoverage(page)
      await openSmallTeamWithRetries(page, name)
      await expect
        .poll(async () => blockButtonsState(page, id), {message: 'the block buttons store after the reload', timeout: 30_000})
        .toEqual({loaded: true, shown: false})
      await expect(page.getByTestId(T.CHAT_BLOCK_BUTTONS), 'the row after a reload').toHaveCount(0)
      await step(page, testInfo, 'still dismissed after a reload')
    })
  }, [async () => restoreToSmoke(page), async () => deleteSubteamIfPresent(name)])
})
