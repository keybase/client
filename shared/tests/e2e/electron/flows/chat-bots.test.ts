// Installing the second account as a restricted bot from a team's Bots tab, editing which channels
// it reads, offering it to another conversation, and uninstalling it. Everything happens in a
// subteam of the e2e team that this run makes and deletes after; the second account is never in it
// other than as that restricted bot, and is never a featured bot.
import {randomBytes} from 'crypto'
import type {Page} from '@playwright/test'
import {test, expect, e2eMarker, seedChatData} from '@/tests/e2e/electron/helpers/fixtures'
import {clickUnoccluded, messageMenu, sendAsSecond, threadHeaderTitle, waitEnabledSteady, waitForRow} from '@/tests/e2e/electron/helpers/chat'
import {withCleanup} from '@/tests/e2e/electron/helpers/cleanup'
import {closeLeftoverModals} from '@/tests/e2e/electron/helpers/modal'
import {openMenu} from '@/tests/e2e/electron/helpers/menu'
import escapeRegExp from 'lodash/escapeRegExp'
import {navigateToChat, openE2ESubteam} from '@/tests/e2e/electron/helpers/navigate'
import {step} from '@/tests/e2e/electron/helpers/step'
import {createThrowawaySubteam, deleteThrowawaySubteam, type ChatData} from '@/tests/e2e/shared/chat-data'
import {convIDBytes} from '@/tests/e2e/shared/conv-id'
import {mainRpc} from '@/tests/e2e/shared/main-rpc'
import * as T from '@/tests/e2e/shared/test-ids'

test.use({actionTimeout: 10_000})

let data: ChatData

test.beforeAll(async () => {
  test.setTimeout(20 * 60_000) // a first run seeds; later runs only check
  data = await seedChatData()
})

// TeamRole in the protocol
const restrictedBot = 6
const roleIn = async (convID: string, username: string) =>
  mainRpc<number>('chat.1.local.getTeamRoleInConversation', {convID: convIDBytes(convID), username})
// the channels a restricted bot reads, by conversation id; none means every channel
const botConvs = async (convID: string, username: string) =>
  (await mainRpc<{convs?: Array<string> | null}>('chat.1.local.getBotMemberSettings', {convID: convIDBytes(convID), username})).convs ?? []

const subteamExists = async (name: string) => {
  const res = await mainRpc<Array<{name: {parts: Array<string>}}> | null>('keybase.1.teams.teamListSubteamsRecursive', {
    forceRepoll: true,
    parentTeamName: data.team,
    sessionID: 0,
  })
  return (res ?? []).some(t => t.name.parts.join('.') === name)
}

const menuItem = (page: Page, title: string) => page.getByTestId(T.FLOATING_MENU).getByText(title, {exact: true})
const botsTab = (page: Page) => page.getByTestId(T.TEAMS_BOTS_TAB).locator('visible=true').first()
// a bot's row names its owner, "@<username>" for a user's own bot
const botRow = (page: Page, username: string) =>
  botsTab(page).locator('div').filter({has: page.locator('.icon-gen-iconfont-ellipsis')}).filter({hasText: `@${username}`}).last()

const openBotsTab = async (page: Page, subteam: string) => {
  await openE2ESubteam(page, subteam, 'the subteam this test made')
  await page.getByTestId(T.TEAMS_TAB_BOTS_BUTTON).locator('visible=true').first().click()
  await expect(botsTab(page)).toBeVisible({timeout: 10_000})
}

// In the install modal: opens the channels picker and toggles "All channels", which a new install
// starts with on and an install in one channel starts with off; with `channel`, also picks that
// channel. Then closes the picker.
const pickChannels = async (page: Page, channel?: string) => {
  await page.getByTestId(T.CHAT_BOT_CHANNELS_DROPDOWN).click()
  const picker = page.getByTestId(T.CHAT_BOT_CHANNEL_PICKER)
  await expect(picker).toBeVisible({timeout: 10_000})
  await clickUnoccluded(picker.getByText('All channels', {exact: true}))
  if (channel) await clickUnoccluded(page.getByText(channel, {exact: true}).last())
  await clickUnoccluded(page.getByText('Done', {exact: true}).locator('visible=true').last())
  await expect(picker).toHaveCount(0, {timeout: 5_000})
}

test('install second as a restricted bot in one channel, edit it to all channels, remove it', async ({page}, testInfo) => {
  test.setTimeout(300_000)
  const {secondUser} = data
  // a deleted team's name is not free again, so each attempt in a run takes its own
  const {generalConvID, name} = await createThrowawaySubteam(`bot${randomBytes(2).toString('hex')}`)
  await withCleanup(async () => {
    await openBotsTab(page, name)
    // the tab has loaded once it offers to install; the service reads the second account as no member
    await expect(botsTab(page).getByText('Install bots', {exact: true})).toBeVisible({timeout: 10_000})
    expect(await roleIn(generalConvID, secondUser), "the second account's role in the new subteam").toBe(0)
    await expect(botRow(page, secondUser), 'the second account in a new subteam\'s bots').toHaveCount(0)
    await botsTab(page).getByText('Install bots', {exact: true}).click()
    const search = page.getByPlaceholder('Search featured bots or users...')
    await expect(search).toBeVisible({timeout: 10_000})
    await search.fill(secondUser)
    const result = page.getByTestId(T.CHAT_BOT_SEARCH_RESULTS).getByText(secondUser, {exact: true})
    await expect(result, 'the second account among the users found').toBeVisible({timeout: 15_000})
    await clickUnoccluded(result)

    // a new install is a restricted bot unless changed
    const review = page.getByText('Review', {exact: true}).locator('visible=true').last()
    await expect(page.getByText('Restricted bot (recommended)', {exact: true}).first()).toBeVisible({timeout: 10_000})
    await clickUnoccluded(review)
    await pickChannels(page, 'general')
    await expect(page.getByTestId(T.CHAT_BOT_CHANNELS_DROPDOWN)).toContainText('(#general)')
    await step(page, testInfo, 'install in general')
    await clickUnoccluded(page.getByText('Install', {exact: true}).locator('visible=true').last())
    await expect(page.getByTestId(T.CHAT_BOT_CHANNELS_DROPDOWN)).toHaveCount(0, {timeout: 20_000})

    await expect(botRow(page, secondUser), 'the bot in the Bots tab').toBeVisible({timeout: 20_000})
    await expect.poll(async () => roleIn(generalConvID, secondUser), {message: "the second account's role in the subteam", timeout: 20_000}).toBe(restrictedBot)
    expect(await botConvs(generalConvID, secondUser), 'the channels the bot reads').toEqual([generalConvID])
    await step(page, testInfo, 'bot installed')

    const edit = menuItem(page, 'Edit settings')
    await openMenu(page, botRow(page, secondUser).locator('.icon-gen-iconfont-ellipsis').last(), edit, 'the bot row menu')
    await edit.click()
    // the button is enabled once the bot's settings and the channels are in, and a reload of either
    // disables it again for a moment: the one press waits until it has stayed enabled
    const editButton = page.getByTestId(T.CHAT_BOT_EDIT_BUTTON).locator('visible=true')
    await waitEnabledSteady(editButton, 'the bot Edit settings button')
    await clickUnoccluded(editButton)
    await expect(page.getByTestId(T.CHAT_BOT_CHANNELS_DROPDOWN), 'the bot edit screen').toContainText('(#general)', {timeout: 10_000})
    await pickChannels(page)
    await expect(page.getByTestId(T.CHAT_BOT_CHANNELS_DROPDOWN)).toContainText('(all channels)')
    await clickUnoccluded(page.getByText('Save', {exact: true}).locator('visible=true').last())
    await expect(page.getByTestId(T.CHAT_BOT_CHANNELS_DROPDOWN)).toHaveCount(0, {timeout: 20_000})
    await expect.poll(async () => botConvs(generalConvID, secondUser), {message: 'the channels the bot reads after the edit', timeout: 20_000}).toEqual([])
    await step(page, testInfo, 'bot on all channels')

    // a message the bot posts offers to install it elsewhere, which searches where it could go
    const text = e2eMarker('bot')
    await sendAsSecond(generalConvID, text)
    // the subteam's conversation, through inbox search, which can be slow to find a new team
    await expect(async () => {
      await navigateToChat(page)
      await page.keyboard.press('Meta+k')
      const inboxSearch = page.getByPlaceholder('Search', {exact: true})
      await expect(inboxSearch).toBeFocused({timeout: 5_000})
      await inboxSearch.fill(name)
      const result = page.locator('.text_BodySemibold').filter({hasText: new RegExp(`^${escapeRegExp(name)}$`)}).first()
      try {
        await clickUnoccluded(result, 10_000)
      } catch (e) {
        await page.keyboard.press('Escape')
        throw e
      }
      await expect(threadHeaderTitle(page)).toContainText(name, {timeout: 10_000})
    }, 'the subteam through inbox search').toPass({intervals: [2_000], timeout: 60_000})
    const ordinal = await waitForRow(page, text, 30_000)
    const menu = await messageMenu(page, ordinal)
    await clickUnoccluded(menu.getByText('Install bot in another team or chat', {exact: true}))
    const picker = page.getByPlaceholder('Search chats and teams...')
    await expect(picker).toBeVisible({timeout: 10_000})
    await picker.fill(name)
    await expect(page.locator('#modal-root').getByText(name, {exact: true}).first(), 'the subteam among the places to install it').toBeVisible({timeout: 15_000})
    await step(page, testInfo, 'install elsewhere')
    await closeLeftoverModals(page)

    await openBotsTab(page, name)
    const uninstall = menuItem(page, 'Uninstall')
    await openMenu(page, botRow(page, secondUser).locator('.icon-gen-iconfont-ellipsis').last(), uninstall, 'the bot row menu')
    await uninstall.click()
    await clickUnoccluded(page.getByText('Uninstall', {exact: true}).locator('visible=true').last())
    await expect.poll(async () => roleIn(generalConvID, secondUser), {message: "the second account's role after Uninstall", timeout: 20_000}).toBe(0)
    await expect(botRow(page, secondUser), 'the bot in the Bots tab after Uninstall').toHaveCount(0, {timeout: 20_000})
    await step(page, testInfo, 'bot removed')
  }, [
    // deleting the subteam takes the bot with it
    async () => {
      await deleteThrowawaySubteam(name)
      await expect.poll(async () => subteamExists(name), {message: 'the subteam after its delete', timeout: 30_000}).toBe(false)
    },
    async () => closeLeftoverModals(page),
  ])
})
