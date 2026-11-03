// What the app sends to file a conversation in the inbox: hide the smoke account's conversation
// with the second account until a new message, mute and unmute it, mark a team's channels read,
// pin the self conversation, and the inbox filter and thread search finding what the run sent.
// The shared conversation with the second account ends each test with the status, mute and pin it
// started with; each change is read back through the main service.
import type {Locator, Page} from '@playwright/test'
import {test, expect, e2eMarker, seedChatData} from '@/tests/e2e/electron/helpers/fixtures'
import {
  clickUnoccluded,
  closeSearch,
  inboxRow,
  openChannelWithRetries,
  openDirectConversation,
  openThreadSearch,
  rowByOrdinal,
  scrollInboxTo,
  searchFor,
  sendAsSecond,
  sendMessage,
  threadHeaderTitle,
} from '@/tests/e2e/electron/helpers/chat'
import {withCleanup} from '@/tests/e2e/electron/helpers/cleanup'
import {openMenu} from '@/tests/e2e/electron/helpers/menu'
import {navigateToChat} from '@/tests/e2e/electron/helpers/navigate'
import {expectPersists} from '@/tests/e2e/electron/helpers/persisted'
import {step} from '@/tests/e2e/electron/helpers/step'
import {
  E2E_CHANNELS,
  createThrowawayChannel,
  deleteThrowawayChannel,
  directConvIDFromCli,
  type ChatData,
} from '@/tests/e2e/shared/chat-data'
import {conversationStatus, mainConversation, mainRpc, restoreConversationStatus} from '@/tests/e2e/shared/main-rpc'
import * as T from '@/tests/e2e/shared/test-ids'

test.use({actionTimeout: 10_000})

let data: ChatData

test.beforeAll(async () => {
  test.setTimeout(20 * 60_000) // a first run seeds; later runs only check
  data = await seedChatData()
})

const infoPanel = (page: Page) => page.getByTestId(T.CHAT_INFO_PANEL)
const infoButton = (page: Page) => page.locator('.icon-gen-iconfont-info:visible').first()
const menuItem = (page: Page, title: string) => page.getByTestId(T.FLOATING_MENU).getByText(title, {exact: true})

const closeInfoPanel = async (page: Page) => {
  // left open, it stays open in every conversation after
  if (await infoPanel(page).isVisible()) {
    await infoButton(page).click()
    await expect(infoPanel(page)).toHaveCount(0, {timeout: 5_000})
  }
}

// A small conversation's gear shows only while its inbox row is hovered.
const openRowMenu = async (page: Page, row: Locator, item: string) => {
  await row.hover()
  await openMenu(page, row.locator('.conversation-gear'), menuItem(page, item), `the inbox row menu (${item})`)
}

const statusOf = async (convID: string) => (await mainConversation(convID)).info.status

// Puts a conversation's status back to what it was, through the main service, and reads it back.
const restoreStatus = async (convID: string, original: number) => {
  if ((await statusOf(convID)) === original) return
  await restoreConversationStatus(convID, original)
  await expect.poll(async () => statusOf(convID), {message: 'the restored conversation status', timeout: 15_000}).toBe(original)
}

test.describe('the conversation with the second account', () => {
  test('hide the DM and a new message brings it back', async ({page}, testInfo) => {
    test.setTimeout(120_000)
    const {convID} = data.direct
    const original = await statusOf(convID)
    expect(original, 'the conversation starts unfiled (a failed restore leaves it hidden or muted)').toBe(conversationStatus.unfiled)
    const row = inboxRow(page, data.secondUser)
    await withCleanup(async () => {
      await scrollInboxTo(page, row, 'the conversation with the second account')
      await openRowMenu(page, row, 'Hide until next message')
      await menuItem(page, 'Hide until next message').click()
      await expect.poll(async () => statusOf(convID), {message: 'the status after Hide', timeout: 15_000}).toBe(conversationStatus.ignored)
      await expect(row, 'the hidden row').toHaveCount(0, {timeout: 10_000})
      await step(page, testInfo, 'conversation hidden')

      await sendAsSecond(convID, e2eMarker('unhide'))
      await expect.poll(async () => statusOf(convID), {message: 'the status after the new message', timeout: 30_000}).toBe(conversationStatus.unfiled)
      await scrollInboxTo(page, row, 'the conversation with the second account, after its new message')
      await step(page, testInfo, 'conversation back')
    }, [
      async () => restoreStatus(convID, original),
      // reads the new message, so the conversation is not left unread
      async () => openDirectConversation(page, data.secondUser),
    ])
  })

  test('mute and unmute the DM', async ({page}, testInfo) => {
    test.setTimeout(150_000)
    const {convID} = data.direct
    const original = await statusOf(convID)
    expect(original, 'the conversation starts unfiled (a failed restore leaves it hidden or muted)').toBe(conversationStatus.unfiled)
    const row = inboxRow(page, data.secondUser)
    const mutedIcon = row.locator('.overlay-icon.muted')
    const muteBox = (p: Page) => infoPanel(p).getByText('Mute all notifications', {exact: true})
    const openSettings = async () => {
      await openDirectConversation(page, data.secondUser)
      if (!(await infoPanel(page).isVisible())) await infoButton(page).click()
      await infoPanel(page).getByTestId(T.CHAT_INFO_PANEL_SETTINGS_TAB).click()
      await expect(muteBox(page)).toBeVisible({timeout: 5_000})
    }
    await withCleanup(async () => {
      await openSettings()
      await muteBox(page).click()
      await expect.poll(async () => statusOf(convID), {message: 'the status after Mute', timeout: 15_000}).toBe(conversationStatus.muted)
      await expect(mutedIcon.first(), 'the muted icon on the inbox row').toBeVisible({timeout: 10_000})
      await step(page, testInfo, 'conversation muted')
      await expectPersists(
        page,
        async () => {
          await scrollInboxTo(page, row, 'the conversation with the second account')
          await expect(mutedIcon.first()).toBeVisible({timeout: 10_000})
          return mutedIcon.first().isVisible()
        },
        true,
        'the muted icon on the inbox row'
      )

      await openSettings()
      await muteBox(page).click()
      await expect.poll(async () => statusOf(convID), {message: 'the status after Unmute', timeout: 15_000}).toBe(conversationStatus.unfiled)
      await expect(mutedIcon, 'the muted icon after unmuting').toHaveCount(0, {timeout: 10_000})
      await step(page, testInfo, 'conversation unmuted')
    }, [async () => restoreStatus(convID, original), async () => closeInfoPanel(page)])
  })
})

test('mark the team\'s channels read', async ({page}, testInfo) => {
  test.setTimeout(150_000)
  const {convID, topicName} = await createThrowawayChannel('read')
  await withCleanup(async () => {
    await sendAsSecond(convID, e2eMarker('unread'))
    const unread = async () => {
      const {readerInfo} = await mainConversation(convID)
      return readerInfo.readMsgid < readerInfo.maxMsgid
    }
    await expect.poll(unread, {message: 'the channel is unread for the smoke account', timeout: 30_000}).toBe(true)

    const inbox = page.getByTestId(T.CHAT_INBOX_LIST)
    const channelName = inbox.getByText(topicName, {exact: true})
    await scrollInboxTo(page, channelName, `#${topicName}`)
    const weight = async () => Number(await channelName.evaluate(el => (globalThis as unknown as {getComputedStyle: (e: unknown) => {fontWeight: string}}).getComputedStyle(el).fontWeight))
    await expect.poll(weight, {message: 'the unread channel row is bold', timeout: 15_000}).toBeGreaterThanOrEqual(600)
    await step(page, testInfo, 'channel unread')

    // the team's header row in the inbox: its name and the gear beside it
    const header = inbox
      .getByText(data.team, {exact: true})
      .locator('xpath=ancestor::div[.//*[contains(@class,"icon-gen-iconfont-gear")]][1]')
    await expect(header, 'the e2e team header in the inbox').toBeVisible({timeout: 5_000})
    const markRead = menuItem(page, 'Mark all as read')
    await openMenu(page, header.locator('.icon-gen-iconfont-gear').first(), markRead, 'the team menu')
    await markRead.click()

    await expect.poll(unread, {message: 'the channel is unread after Mark all as read', timeout: 15_000}).toBe(false)
    await expect.poll(weight, {message: 'the read channel row is not bold', timeout: 10_000}).toBeLessThan(600)
    await step(page, testInfo, 'team read')
  }, [async () => deleteThrowawayChannel(topicName)])
})

test.describe('pin', () => {
  const pinnedCategory = 'chatPinnedConvs'
  type GregorState = {items?: Array<{item?: {body?: Uint8Array | null; category: string} | null}> | null}
  const pinnedConvs = async (): Promise<Array<string>> => {
    const state = await mainRpc<GregorState>('keybase.1.gregor.getState', {})
    const body = state.items?.find(i => i.item?.category === pinnedCategory)?.item?.body
    return body ? (JSON.parse(Buffer.from(body).toString('utf8')) as Array<string>) : []
  }

  test('pin a conversation in the inbox', async ({page}, testInfo) => {
    test.setTimeout(150_000)
    const selfConvID = await directConvIDFromCli(data.smokeUser)
    const original = await pinnedConvs()
    expect(original, 'the pinned conversations this test starts from (a failed restore leaves the self conversation pinned)').not.toContain(selfConvID)
    const row = inboxRow(page, data.smokeUser)
    const pinIcon = row.locator('.icon-gen-iconfont-pin-solid')
    const restorePins = async () => {
      if (JSON.stringify(await pinnedConvs()) === JSON.stringify(original)) return
      await mainRpc('keybase.1.gregor.updateCategory', {body: JSON.stringify(original), category: pinnedCategory, dtime: {offset: 0, time: 0}})
      await expect.poll(pinnedConvs, {message: 'the restored pinned conversations', timeout: 15_000}).toEqual(original)
    }
    await withCleanup(async () => {
      await scrollInboxTo(page, row, 'the self conversation')
      await openRowMenu(page, row, 'Pin to top')
      await menuItem(page, 'Pin to top').click()
      await expect.poll(pinnedConvs, {message: 'the pinned conversations after Pin to top', timeout: 15_000}).toContain(selfConvID)
      await expect(pinIcon, 'the pin on the self conversation row').toBeVisible({timeout: 10_000})
      await step(page, testInfo, 'conversation pinned')
      await expectPersists(
        page,
        async () => {
          await scrollInboxTo(page, row, 'the self conversation')
          await expect(pinIcon).toBeVisible({timeout: 10_000})
          return pinIcon.isVisible()
        },
        true,
        'the pin on the self conversation row'
      )

      await openRowMenu(page, row, 'Unpin')
      await menuItem(page, 'Unpin').click()
      await expect.poll(pinnedConvs, {message: 'the pinned conversations after Unpin', timeout: 15_000}).toEqual(original)
      await expect(pinIcon, 'the pin after Unpin').toHaveCount(0, {timeout: 10_000})
      await step(page, testInfo, 'conversation unpinned')
    }, [restorePins])
  })
})

test('inbox filter finds a channel by name', async ({page}, testInfo) => {
  await navigateToChat(page)
  await page.keyboard.press('Meta+k')
  const search = page.getByPlaceholder('Search', {exact: true})
  await expect(search).toBeFocused({timeout: 5_000})
  await search.fill(E2E_CHANNELS.short)
  const result = page.getByText(`#${E2E_CHANNELS.short}`, {exact: true}).first()
  await expect(result, 'the channel in the filter results').toBeVisible({timeout: 10_000})
  await expect(page.getByText(`#${E2E_CHANNELS.long}`, {exact: true}), 'a channel the filter does not match').toHaveCount(0)
  await step(page, testInfo, 'filter results')
  await clickUnoccluded(result)
  await expect(threadHeaderTitle(page)).toHaveText(`${data.team}#${E2E_CHANNELS.short}`, {timeout: 10_000})
})

test('thread search finds a stamped word', async ({page}, testInfo) => {
  test.setTimeout(120_000)
  await openChannelWithRetries(page, data.team, E2E_CHANNELS.scratch)
  // unique to this post: the search splits the stamp at its dashes and matches every part
  const text = e2eMarker('zebraword')
  const ordinal = await sendMessage(page, text)
  await expect(rowByOrdinal(page, ordinal).locator('.sendingStatus')).toHaveCount(0, {timeout: 15_000})
  await openThreadSearch(page)
  try {
    // the service indexes a message just after it lands: a search that runs first is run again
    await expect(async () => {
      const hits = await searchFor(page, text)
      expect(hits, 'the search hits').toHaveLength(1)
      expect(hits[0]).toContain(text)
    }, 'one hit for the stamped word').toPass({intervals: [2_000], timeout: 45_000})
    await step(page, testInfo, 'search hit')
  } finally {
    await closeSearch(page)
  }
})
