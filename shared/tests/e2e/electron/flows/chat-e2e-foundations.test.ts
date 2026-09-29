// Proves the chat e2e harness itself: the seeded channels open by name, the geometry helpers read
// sane values off the thread, thread search finds a seeded word, and the second account's messages
// arrive. The behaviour flows build on these.
import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {
  closeMenu,
  closeSearch,
  composer,
  endTolerancePx,
  isOrdinalCentred,
  loadedOrdinalRange,
  messageMenu,
  openConversationByName,
  openSelfConversation,
  openThreadSearch,
  ordinalRect,
  searchFor,
  selectHit,
  sendMessage,
  waitForRow,
  waitForScrollStable,
} from '@/tests/e2e/electron/helpers/chat'
import {
  E2E_CHANNELS,
  LONG_COUNT,
  LONG_SEARCH_TOKENS,
  ensureChatData,
  longMarker,
  readonlyMarker,
  type ChatData,
} from '@/tests/e2e/shared/chat-data'
import {findIncomingSender} from '@/tests/e2e/shared/incoming-sender'

let data: ChatData

test.beforeAll(async () => {
  test.setTimeout(20 * 60_000) // a first run seeds; later runs only check
  data = await ensureChatData()
})

test('seeded channels and the self conversation open by name', async ({page}) => {
  await openConversationByName(page, data.team, E2E_CHANNELS.readonly)
  await waitForRow(page, readonlyMarker(1))
  for (const channel of [E2E_CHANNELS.scratch, E2E_CHANNELS.media, E2E_CHANNELS.long]) {
    await openConversationByName(page, data.team, channel)
  }
  await openSelfConversation(page, data.smokeUser)
})

test('opening the long channel lands at the bottom and the geometry reads sanely', async ({page}) => {
  await openConversationByName(page, data.team, E2E_CHANNELS.long)
  const lastOrdinal = await waitForRow(page, longMarker(LONG_COUNT))
  const geometry = await waitForScrollStable(page)
  expect(geometry.distanceFromEnd).toBeLessThanOrEqual(endTolerancePx)
  expect(geometry.scrollHeight).toBeGreaterThan(geometry.clientHeight)

  const range = await loadedOrdinalRange(page)
  expect(range?.max).toBe(lastOrdinal)
  expect(range?.count).toBeGreaterThan(5)

  // the newest row sits at the bottom of the viewport
  const rect = await ordinalRect(page, lastOrdinal)
  expect(rect).toBeDefined()
  expect(Math.abs((rect?.bottom ?? 0) - (rect?.viewHeight ?? 0))).toBeLessThanOrEqual(40)
  const centred = await isOrdinalCentred(page, lastOrdinal)
  expect(centred.centred).toBe(false)
  expect(centred.offset).toBeGreaterThan(0)
})

test('thread search finds a seeded word', async ({page}) => {
  await openConversationByName(page, data.team, E2E_CHANNELS.long)
  await openThreadSearch(page)
  const {index, token} = LONG_SEARCH_TOKENS.middle
  const hits = await searchFor(page, token)
  expect(hits).toHaveLength(1)
  expect(hits[0]).toContain(longMarker(index))
  await selectHit(page, 0)
  const ordinal = await waitForRow(page, longMarker(index))
  await expect.poll(async () => (await isOrdinalCentred(page, ordinal, 40)).centred, {timeout: 10_000}).toBe(true)
  await closeSearch(page)
})

test('a message sent from the composer shows up and clears the composer', async ({page}) => {
  await openConversationByName(page, data.team, E2E_CHANNELS.scratch)
  const text = `e2e-foundations-send-${Date.now()}`
  const ordinal = await sendMessage(page, text)
  expect(await composer.getText(page)).toBe('')
  const menu = await messageMenu(page, ordinal)
  await expect(menu.getByText('Reply', {exact: true})).toBeVisible({timeout: 5_000})
  await closeMenu(page)
})

test('a message from the second account arrives', async ({page}) => {
  const sender = await findIncomingSender(data.secondUser)
  test.skip(!sender.ok, sender.ok ? '' : `second-account sender unavailable: ${sender.reason}`)
  if (!sender.ok) return
  await openConversationByName(page, data.team, E2E_CHANNELS.scratch)
  const text = `e2e-foundations-incoming-${Date.now()}`
  await sender.send(data.convIDs[E2E_CHANNELS.scratch], data.team, text)
  await waitForRow(page, text, 20_000)
})
