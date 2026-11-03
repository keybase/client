// What the app sends for a message once it is in the thread: an edit, a forward to the self
// conversation, a private reply, an exploding message running out, a channel's history cleared, a
// pinned message dismissed by a member, the emoji skin tone, and a GIF from /giphy. Each acts in
// e2e-scratch, the self conversation or a throwaway channel this run made in the e2e team, and every
// body it sends starts with the run's stamp.
import type {Page} from '@playwright/test'
import {test, expect, e2eMarker, seedChatData} from '@/tests/e2e/electron/helpers/fixtures'
import {asSecond, RESTORE_WORST_MS, restoreToSmoke} from '@/tests/e2e/electron/helpers/accounts'
import {
  clickUnoccluded,
  composer,
  composerInput,
  messageMenu,
  openChannelWithRetries,
  openE2EChannel,
  rowByOrdinal,
  sendMessage,
  threadHeaderTitle,
  waitForRow,
} from '@/tests/e2e/electron/helpers/chat'
import {withCleanup} from '@/tests/e2e/electron/helpers/cleanup'
import {openMenu, waitOutPopupDebounce} from '@/tests/e2e/electron/helpers/menu'
import {expectPersists} from '@/tests/e2e/electron/helpers/persisted'
import {step} from '@/tests/e2e/electron/helpers/step'
import {
  E2E_CHANNELS,
  attachFromCli,
  createThrowawayChannel,
  deleteThrowawayChannel,
  readFromCli,
  sendToThrowawayFromCli,
  type ChatData,
} from '@/tests/e2e/shared/chat-data'
import {mainRpc, mainRpcAsSecond} from '@/tests/e2e/shared/main-rpc'
import {convIDBytes} from '@/tests/e2e/shared/conv-id'
import {peerSender} from '@/tests/e2e/shared/peer-actors'
import {loadE2EEnv} from '@/tests/e2e/accounts/env'
import * as T from '@/tests/e2e/shared/test-ids'

test.use({actionTimeout: 10_000})

let data: ChatData

test.beforeAll(async () => {
  test.setTimeout(20 * 60_000) // a first run seeds; later runs only check
  data = await seedChatData()
})

const threadRows = (page: Page) => page.getByTestId(T.CHAT_MESSAGE_LIST).locator('[data-ordinal]')
const rowWithText = (page: Page, text: string) => threadRows(page).filter({hasText: text})
// Kb.Text's virtualText draws its words from this attribute, so they are not in the DOM's text
const virtualText = (text: string) => `[data-virtual-text="${text}"]`

// The send indicator goes once the service has the message, and with it the row gets its id.
const waitForSent = async (page: Page, ordinal: number) => {
  await expect(rowByOrdinal(page, ordinal).locator('.sendingStatus')).toHaveCount(0, {timeout: 15_000})
}

const infoButton = (page: Page) => page.locator('.icon-gen-iconfont-info:visible').first()

test('edit a sent message', async ({page}, testInfo) => {
  await openE2EChannel(page)
  const before = e2eMarker('edit')
  const ordinal = await sendMessage(page, before)
  await waitForSent(page, ordinal)

  const menu = await messageMenu(page, ordinal)
  await clickUnoccluded(menu.getByText('Edit', {exact: true}))
  await expect(page.getByTestId(T.CHAT_EDIT_CANCEL)).toBeVisible({timeout: 5_000})
  await expect.poll(async () => composer.getText(page), {timeout: 5_000}).toBe(before)
  const after = e2eMarker('edited')
  await composerInput(page).fill(after)
  await composer.press(page, 'Enter')

  const row = rowByOrdinal(page, ordinal)
  // the row says EDITED once the edit has landed; the text is read after that
  await expect(row.locator(virtualText('EDITED'))).toHaveCount(1, {timeout: 15_000})
  await expect(row).toContainText(after)
  await expect(row).not.toContainText(before)
  await step(page, testInfo, 'edited row')

  await expect
    .poll(async () => (await readFromCli({topicName: E2E_CHANNELS.scratch})).filter(m => m.content.type === 'text').map(m => m.content.text?.body), {
      message: 'the CLI reads the edited body',
      timeout: 20_000,
    })
    .toContain(after)
  const bodies = (await readFromCli({topicName: E2E_CHANNELS.scratch})).map(m => m.content.text?.body)
  expect(bodies, 'the CLI no longer reads the old body').not.toContain(before)
})

// OutboxRecord's message is `Msg` in the service's encoding
type ThreadRow = {state: number; outbox?: {outboxID: unknown; Msg?: {messageBody?: {text?: {body?: string}}}} | null}
const outboxState = 3 // MessageUnboxedState.outbox

// The outbox records in e2e-scratch whose body starts with `marker`, as the main service reads the
// thread (outbox records ride along with the server's messages).
const outboxWith = async (marker: string) => {
  const res = await mainRpc<{thread?: {messages?: Array<ThreadRow> | null}}>('chat.1.local.getThreadLocal', {
    conversationID: convIDBytes(data.convIDs[E2E_CHANNELS.scratch]),
    identifyBehavior: 6, // chatSkip
    pagination: {num: 50},
    query: null,
    reason: 0,
  })
  return (res.thread?.messages ?? []).filter(m => m.state === outboxState && (m.outbox?.Msg?.messageBody?.text?.body ?? '').startsWith(marker))
}

// The service refuses a text over 10000 bytes before it leaves the outbox (msgchecker), so it never
// reaches the server: the row stays failed, offering Edit or Cancel, and Cancel drops it. The failed
// record survives reloads and never reaches the server, where the sweep looks, so whatever the test
// did, the cleanup cancels any record with the marker through the service and reads that back.
test('a message over the length limit fails and Cancel drops it', async ({page}, testInfo) => {
  const marker = e2eMarker('toolong')
  await withCleanup(
    async () => {
      await openE2EChannel(page)
      await composerInput(page).click({timeout: 5_000})
      await composerInput(page).fill(`${marker} ${'x'.repeat(10_001)}`, {timeout: 5_000})
      await composer.press(page, 'Enter')
      const row = rowWithText(page, marker)
      await expect(row.locator(virtualText('Cancel')), 'the failed row offers Cancel').toHaveCount(1, {timeout: 30_000})
      await expect(row.locator(virtualText('Edit')), 'the failed row offers Edit').toHaveCount(1)
      expect(await outboxWith(marker), 'the failed record in the outbox').toHaveLength(1)
      await step(page, testInfo, 'too long message failed', {card: true})
      await row.locator(virtualText('Cancel')).click()
      await expect(row, 'the failed row after Cancel').toHaveCount(0, {timeout: 15_000})
      await step(page, testInfo, 'failed row cancelled')
      // an outbox item survives a reload, so a reload shows whether the service dropped it
      await expectPersists(
        page,
        async () => {
          await openE2EChannel(page)
          await expect(threadRows(page).first()).toBeVisible({timeout: 15_000})
          return rowWithText(page, marker).count()
        },
        0,
        'the cancelled message in e2e-scratch'
      )
      expect(await outboxWith(marker), 'the outbox after Cancel').toHaveLength(0)
      const bodies = (await readFromCli({topicName: E2E_CHANNELS.scratch})).map(m => m.content.text?.body ?? '')
      expect(bodies.some(b => b.startsWith(marker)), 'the CLI reads no message with the marker').toBe(false)
    },
    [
      async () => {
        for (const m of await outboxWith(marker)) await mainRpc('chat.1.local.CancelPost', {outboxID: m.outbox?.outboxID})
        expect(await outboxWith(marker), 'outbox records with the marker after the cleanup').toHaveLength(0)
      },
    ]
  )
})

// Forward is offered only for attachments and messages with unfurls, so the test sends its own
// image (titled for the run) to e2e-scratch and forwards that.
test('forward a message to the self conversation', async ({page}, testInfo) => {
  test.setTimeout(90_000)
  await openE2EChannel(page)
  const title = e2eMarker('fwd')
  await attachFromCli(E2E_CHANNELS.scratch, title)
  const ordinal = await waitForRow(page, title, 30_000)

  const menu = await messageMenu(page, ordinal)
  await clickUnoccluded(menu.getByText('Forward', {exact: true}))
  const search = page.getByPlaceholder('Search chats and teams...')
  await expect(search).toBeVisible({timeout: 5_000})
  await search.fill(data.smokeUser)
  // in the modal, not the inbox row of the same name behind it
  const self = page.locator('#modal-root').getByText(data.smokeUser, {exact: true})
  await expect(self, 'the self conversation in the forward picker').toBeVisible({timeout: 10_000})
  await clickUnoccluded(self)
  // an attachment asks for its caption: the forward keeps the run's title
  const caption = page.getByPlaceholder('Add a caption...').locator('visible=true')
  await expect(caption).toBeVisible({timeout: 5_000})
  await caption.fill(title)
  await step(page, testInfo, 'forward caption')
  await clickUnoccluded(page.getByText('Send', {exact: true}).locator('visible=true').last())

  // the forward opens the destination
  await expect(composerInput(page)).toHaveAttribute('placeholder', 'Message yourself', {timeout: 15_000})
  await expect(threadRows(page).last()).toContainText(title, {timeout: 30_000})
  await step(page, testInfo, 'forwarded row')
  await expect
    .poll(async () => (await readFromCli({tlfName: data.smokeUser}, 5))[0]?.content.attachment?.object?.title, {
      message: "the self conversation's newest message, from the CLI",
      timeout: 30_000,
    })
    .toBe(title)
})

test.describe('reply privately', () => {
  test.afterEach(async ({page}) => {
    // the quote was put in the direct conversation's composer, which saves it as its draft
    if ((await threadHeaderTitle(page).innerText({timeout: 5_000}).catch(() => '')) === data.secondUser) {
      await composerInput(page).fill('', {timeout: 5_000})
      await expect.poll(async () => composer.getText(page), {timeout: 5_000}).toBe('')
    }
  })

  test('reply privately opens the DM with the quote', async ({page}, testInfo) => {
    const sender = await peerSender(loadE2EEnv())
    await openE2EChannel(page)
    const text = e2eMarker('private')
    await sender.send(data.convIDs[E2E_CHANNELS.scratch], text)
    const ordinal = await waitForRow(page, text, 20_000)

    const menu = await messageMenu(page, ordinal)
    await clickUnoccluded(menu.getByText('Reply privately', {exact: true}))
    await expect(threadHeaderTitle(page)).toHaveText(data.secondUser, {timeout: 10_000})
    await expect.poll(async () => composer.getText(page), {timeout: 10_000}).toBe(`> ${text}\n`)
    await step(page, testInfo, 'quote in the direct conversation')
  })
})

// In a throwaway channel: the exploding mode is the conversation's own setting, which goes with the
// channel. Bound 90s from the send, not 45s: the service queues a due explosion behind its
// background loader of long conversations (BackgroundEphemeralPurger → ConvLoader queue), and after
// flows that opened e2e-scratch or the self conversation it was seen to run 20s past the timer.
test('an exploding message explodes', async ({page}, testInfo) => {
  test.setTimeout(180_000)
  const timerButton = page.locator('.timer-icon-container').locator('visible=true').first()
  const {topicName} = await createThrowawayChannel('explode', {withSecond: false})
  try {
    await openChannelWithRetries(page, data.team, topicName)
    await expect(timerButton.locator('.icon-gen-iconfont-timer'), 'a new channel starts with exploding messages off').toHaveCount(1, {
      timeout: 10_000,
    })
    const thirty = page.getByText('30 seconds', {exact: true})
    await openMenu(page, timerButton, thirty, 'the exploding timer menu')
    await clickUnoccluded(thirty)
    await expect(timerButton).toContainText('30s', {timeout: 5_000})

    const text = e2eMarker('explode')
    const ordinal = await sendMessage(page, text)
    const row = rowByOrdinal(page, ordinal)
    const countdown = row.getByTestId(T.CHAT_EXPLODING_META).locator('.explodingTimeText')
    await expect(countdown).toHaveAttribute('data-virtual-text', /^\d+s$/, {timeout: 15_000})
    await step(page, testInfo, 'countdown')
    await expect(row.locator(virtualText('EXPLODED')), 'the row 90s after the send').toHaveCount(1, {timeout: 90_000})
    await expect(row).not.toContainText(text)
    await step(page, testInfo, 'exploded')
  } finally {
    await deleteThrowawayChannel(topicName)
  }
})

test('delete history clears a throwaway channel', async ({page}, testInfo) => {
  test.setTimeout(150_000)
  const {topicName} = await createThrowawayChannel('history', {withSecond: false})
  try {
    const texts = [e2eMarker('hist'), e2eMarker('hist'), e2eMarker('hist')]
    for (const t of texts) await sendToThrowawayFromCli(topicName, t)
    const sentAt = Date.now()
    await openChannelWithRetries(page, data.team, topicName)
    for (const t of texts) await waitForRow(page, t, 30_000)

    // the panel stays open from one conversation to the next
    if (!(await page.getByTestId(T.CHAT_INFO_PANEL).isVisible())) await infoButton(page).click()
    await expect(page.getByTestId(T.CHAT_INFO_PANEL)).toBeVisible({timeout: 5_000})
    await page.getByTestId(T.CHAT_INFO_PANEL).getByText('Settings', {exact: true}).click()
    await page.getByText('Clear entire conversation', {exact: true}).click()
    const confirm = page.getByText('Yes, clear for everyone', {exact: true})
    await expect(confirm).toBeVisible({timeout: 5_000})
    await step(page, testInfo, 'clear history confirm')
    // The clear cuts off at the server's time (PostDeleteHistoryByAge → GetMessageBefore, age 0), and
    // messages sent within about 2s before it survive. Nothing signals that the cutoff has passed a
    // message, so this is a fixed wait: until 5s after the last send.
    await page.waitForTimeout(Math.max(0, sentAt + 5_000 - Date.now()))
    await clickUnoccluded(confirm)
    await expect(confirm).toHaveCount(0, {timeout: 5_000})

    for (const t of texts) await expect(rowWithText(page, t)).toHaveCount(0, {timeout: 20_000})
    await step(page, testInfo, 'history cleared')
    await expect
      .poll(async () => (await readFromCli({topicName})).filter(m => m.content.type === 'text').length, {
        message: 'text messages the CLI reads after the clear',
        timeout: 20_000,
      })
      .toBe(0)
  } finally {
    // left open, it covers part of the composer in every conversation after
    if (await page.getByTestId(T.CHAT_INFO_PANEL).isVisible()) {
      await infoButton(page).click()
      await expect(page.getByTestId(T.CHAT_INFO_PANEL)).toHaveCount(0, {timeout: 5_000})
    }
    await deleteThrowawayChannel(topicName)
  }
})

// The conversation's pin as the signed-in second account's service localizes it: 'shown' (a pin
// message and its pinned message), 'ignored' (a pin message, but no pinned message for this
// account, which is how the service applies IgnorePinnedMessage) or 'none' (no pin message yet).
const pinState = async (convID: string) => {
  type Conv = {info: {pinnedMsg?: object | null}; maxMessages?: Array<{messageType: number}> | null}
  const res = await mainRpcAsSecond<{conversations?: Array<Conv> | null}>('chat.1.local.getInboxAndUnboxLocal', {
    identifyBehavior: 6, // chatSkip
    query: {computeActiveList: false, convIDs: [convIDBytes(convID)], readOnly: false, unreadOnly: false},
  })
  const conv = res.conversations?.[0]
  if (!conv) throw new Error('the second account reads no such conversation')
  const pinType = 18 // MessageType.pin
  if (!conv.maxMessages?.some(m => m.messageType === pinType)) return 'none'
  return conv.info.pinnedMsg ? 'shown' : 'ignored'
}

test.describe('pinned banner', () => {
  test.afterEach(async ({page}, testInfo) => {
    testInfo.setTimeout(testInfo.timeout + RESTORE_WORST_MS)
    await restoreToSmoke(page)
  })

  // The smoke account owns the team, so its close unpins for everyone; a writer's close hides the
  // pin for itself only, which is what this checks.
  test('pin then dismiss the pinned banner', async ({page}, testInfo) => {
    test.setTimeout(240_000)
    const {convID, topicName} = await createThrowawayChannel('pin')
    try {
      const banner = page.getByTestId(T.CHAT_PINNED_BANNER)
      await openChannelWithRetries(page, data.team, topicName)
      const text = e2eMarker('pin')
      const ordinal = await sendMessage(page, text)
      await waitForSent(page, ordinal)
      const menu = await messageMenu(page, ordinal)
      await clickUnoccluded(menu.getByText('Pin message', {exact: true}))
      await expect(banner).toContainText(text, {timeout: 15_000})

      await asSecond(page, async () => {
        await openChannelWithRetries(page, data.team, topicName)
        await expect(banner).toContainText(text, {timeout: 15_000})
        await step(page, testInfo, 'pinned banner as the second account')
        await expect(banner.getByTestId(T.CHAT_PINNED_UNPIN), 'a writer is not asked to unpin').toHaveCount(0)
        expect(await pinState(convID), 'the pin as the second account reads it, before the dismiss').toBe('shown')
        await clickUnoccluded(banner.locator('.icon-gen-iconfont-close'))
        await expect.poll(async () => pinState(convID), {message: 'the pin as the second account reads it, after the dismiss', timeout: 15_000}).toBe('ignored')
        await expect(banner).toHaveCount(0, {timeout: 10_000})
        await expectPersists(
          page,
          async () => {
            await openChannelWithRetries(page, data.team, topicName)
            await waitForRow(page, text, 30_000)
            // the service has the pin and hides it from this account, so the banner has nothing to wait for
            expect(await pinState(convID), 'the pin as the second account reads it, after the reload').toBe('ignored')
            return banner.count()
          },
          0,
          'the dismissed pinned banner'
        )
      })
      // dismissing hides it for the second account only
      await openChannelWithRetries(page, data.team, topicName)
      await expect(banner).toContainText(text, {timeout: 15_000})
    } finally {
      await deleteThrowawayChannel(topicName)
    }
  })
})

test.describe('skin tone', () => {
  // the dot color of each tone (T.Chat.SkinToneToDotColor), by its ReacjiSkinTone number
  const toneColors = ['rgb(255, 201, 58)', 'rgb(250, 220, 188)', 'rgb(225, 187, 149)', 'rgb(191, 144, 104)', 'rgb(155, 100, 61)', 'rgb(90, 69, 57)']
  const tone3 = 3
  const picker = (page: Page) => page.getByTestId(T.CHAT_EMOJI_PICKER)

  const openPicker = async (page: Page) => {
    await openE2EChannel(page)
    await page.locator('.icon-gen-iconfont-emoji:visible').last().click()
    await expect(picker(page)).toBeVisible({timeout: 5_000})
  }
  // The popup dismisses on an outside click, not Escape, and ignores one within 100ms of showing
  // (see menu.ts): one click, past that.
  const closePicker = async (page: Page) => {
    await waitOutPopupDebounce(page)
    await page.getByTestId(T.CHAT_MESSAGE_LIST).first().click({force: true, position: {x: 10, y: 10}})
    await expect(picker(page), 'the emoji picker closing').toHaveCount(0, {timeout: 5_000})
  }
  const dotColor = async (page: Page) =>
    page
      .getByTestId(T.CHAT_SKIN_TONE_BUTTON)
      .locator('div')
      .last()
      .evaluate(el => (globalThis as unknown as {getComputedStyle: (e: unknown) => {backgroundColor: string}}).getComputedStyle(el).backgroundColor)
  // the tone the picker shows, by number
  const shownTone = async (page: Page) => {
    await openPicker(page)
    const color = await dotColor(page)
    await closePicker(page)
    const tone = toneColors.indexOf(color)
    if (tone < 0) throw new Error(`the skin tone button shows an unknown color ${color}`)
    return tone
  }
  const savedTone = async () =>
    (await mainRpc<{userReacjis?: {skinTone?: number}}>('keybase.1.config.getBootstrapStatus', {})).userReacjis?.skinTone ?? 0
  const pickTone = async (page: Page, tone: number) => {
    await openPicker(page)
    await page.getByTestId(T.CHAT_SKIN_TONE_BUTTON).click()
    const options = page.getByTestId(T.CHAT_SKIN_TONE_OPTIONS)
    await expect(options).toBeVisible({timeout: 5_000})
    const index = await options.evaluate((el, color) => {
      type El = {children: ArrayLike<El>; querySelectorAll: (s: string) => ArrayLike<El>}
      const g = globalThis as unknown as {getComputedStyle: (e: unknown) => {backgroundColor: string}}
      return Array.from((el as unknown as El).children).findIndex(c => Array.from(c.querySelectorAll('div')).some(d => g.getComputedStyle(d).backgroundColor === color))
    }, toneColors[tone])
    if (index < 0) throw new Error(`no skin tone option shows tone ${tone}`)
    await options.locator(':scope > *').nth(index).click()
    await expect(options).toHaveCount(0, {timeout: 5_000})
    await closePicker(page)
    await expect.poll(savedTone, {message: `the saved skin tone after picking tone ${tone}`, timeout: 15_000}).toBe(tone)
  }

  test('skin tone is saved', async ({page}, testInfo) => {
    test.setTimeout(120_000)
    const original = await savedTone()
    expect(original, 'the skin tone this test starts from (a run that failed to restore it leaves tone 3)').not.toBe(tone3)
    try {
      await pickTone(page, tone3)
      await openPicker(page)
      await step(page, testInfo, 'tone 3 picked')
      await closePicker(page)
      await expectPersists(page, async () => shownTone(page), tone3, 'the skin tone')
    } finally {
      await pickTone(page, original)
    }
  })
})

test('giphy sends a gif', async ({page}, testInfo) => {
  test.setTimeout(120_000)
  // a GIF's body is its url, which cannot carry the run's stamp: it goes to a throwaway channel
  const {topicName} = await createThrowawayChannel('giphy', {withSecond: false})
  try {
    await openChannelWithRetries(page, data.team, topicName)
    await composer.type(page, '/giphy cat')
    const tip = page.getByText("Tip: hit 'Enter' now to send a random GIF.")
    await expect(tip).toBeVisible({timeout: 10_000})
    // the results sit beside the tip, in the box that scrolls them
    const first = page.locator('.text_BodySmall', {hasText: "Tip: hit 'Enter'"}).locator('xpath=ancestor::div[2]').locator('img, video').first()
    await expect(first, 'the first GIF result').toBeVisible({timeout: 20_000})
    await step(page, testInfo, 'giphy results')
    await first.click()
    await expect(tip).toHaveCount(0, {timeout: 10_000})

    const gifRow = threadRows(page).filter({hasText: /giphy\.com\//}).last()
    await expect(gifRow, 'the GIF row').toBeVisible({timeout: 30_000})
    await step(page, testInfo, 'gif row')
    await expect
      .poll(
        async () =>
          (await readFromCli({topicName}, 10))
            .filter(m => m.content.type === 'text' && m.sender.username === data.smokeUser)
            .map(m => m.content.text?.body ?? ''),
        {message: "the smoke account's text messages in the channel, from the CLI", timeout: 20_000}
      )
      .toEqual([expect.stringMatching(/giphy\.com/)])
  } finally {
    await deleteThrowawayChannel(topicName)
  }
})
