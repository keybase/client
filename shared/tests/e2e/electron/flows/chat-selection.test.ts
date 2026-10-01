// Where the desktop's conversation selection goes when the open channel stops being the user's: the
// user leaves it, or the team owner removes them from it. Either way the selection moves to the
// newest conversation, and the thread shows that conversation without an error. A conversation the
// account has not joined, opened from a link, is not gone from it: that selection stays.
//
// The app runs as the second account for these, in a channel made for the run. The desktop CLI
// talks to the app's own service, so while the app is the second account the CLI is too: it sends
// the second account's message that makes its conversation with the owner the newest one. The owner
// acts from the simulator attached to Metro, signed in as the smoke user (see incoming-sender.ts).
import type {Page} from '@playwright/test'
import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {
  clickUnoccluded,
  collectConsoleErrors,
  inboxRow,
  requestLayoutAndReadReselect,
  requireAttachedApp,
  requireAttachedAppAsEither,
  rowByOrdinal,
  selectedInboxRows,
  stopWatchingReselects,
  switchAccount,
  threadHeaderTitle,
  waitForRow,
  watchReselects,
  watchSelectedConversation,
  watchSelection,
} from '@/tests/e2e/electron/helpers/chat'
import {createThrowawayChannel, deleteThrowawayChannels, ensureChatData, sendDirectFromCli, type ChatData} from '@/tests/e2e/shared/chat-data'
import {cliWhoami} from '@/tests/e2e/shared/cli-account'
import {findChannelOwner, switchAttachedApp} from '@/tests/e2e/shared/incoming-sender'
import * as T from '@/tests/e2e/shared/test-ids'

const leavePrefix = 'e2e-leave'
const removedPrefix = 'e2e-kick'
const unjoinedPrefix = 'e2e-nojoin'

// Known console noise across an account switch (see chat-data.test.ts's account switch flows).
const notFromTheMove = [/refreshAccounts|ignorePromise error/, /getUsernameToShow: message with no author/]

let data: ChatData

const requireOwnerCli = async () => {
  const who = await cliWhoami()
// set once the attached app is the owner, for afterAll to hand it back
let ownerAttached = false
  if (who !== data.smokeUser) throw new Error('the desktop app and CLI must start as the smoke user (the team owner)')
}

test.beforeAll(async () => {
  test.setTimeout(10 * 60_000)
  data = await ensureChatData()
  await requireOwnerCli()
  await deleteThrowawayChannels(leavePrefix)
  await deleteThrowawayChannels(removedPrefix)
  await deleteThrowawayChannels(unjoinedPrefix)
  // the owner's side of the removal flow
  await switchAttachedApp(data.smokeUser)
})

  await requireAttachedAppAsEither(data.secondUser, data.smokeUser)
// The attached app goes back to sending as the second account, the part the other chat flows give it.
  ownerAttached = true
test.afterAll(async () => {
  test.setTimeout(90_000)
  await switchAttachedApp(data.secondUser)
})

  if (!ownerAttached) return
test.afterEach(async ({page}) => {
  await switchAccount(page, data.smokeUser)
  await requireOwnerCli()
  await deleteThrowawayChannels(leavePrefix)
  await deleteThrowawayChannels(removedPrefix)
  await deleteThrowawayChannels(unjoinedPrefix)
})

// As the second account, with the throwaway channel open: sends a message to the owner so that
// conversation is the newest, and waits for the inbox to show it there. Returns that message and
// the header the conversation with the owner shows (the owner's full name, when they have one).
// The channel opens from its inbox row, which lists it as soon as the account's inbox loads (inbox
// search can lag behind a channel made moments earlier).
const openChannelAsSecond = async (page: Page, topicName: string) => {
  await switchAccount(page, data.secondUser)
  await clickUnoccluded(inboxRow(page, data.smokeUser))
  await expect.poll(async () => selectedInboxRows(page), {timeout: 10_000}).toEqual([data.smokeUser])
  const newestHeader = await threadHeaderTitle(page).innerText({timeout: 5_000})
  // a different conversation before the channel, so a selection that only goes back is caught
  await clickUnoccluded(inboxRow(page, data.secondUser))
  await expect.poll(async () => selectedInboxRows(page), {timeout: 10_000}).toEqual([data.secondUser])

  const row = page.locator('.inbox-hover-container').getByText(topicName, {exact: true})
  await expect(row).toBeVisible({timeout: 20_000})
  await clickUnoccluded(row)
  await expect(threadHeaderTitle(page)).toHaveText(`${data.team}#${topicName}`, {timeout: 10_000})
  const marker = `e2e-selection-newest-${Date.now()}`
  await sendDirectFromCli(data.direct.tlfName, marker)
  await expect(inboxRow(page, data.smokeUser)).toContainText(marker, {timeout: 20_000})
  return {marker, newestHeader}
}

// The selection is on the conversation with the owner, showing `marker`, and stays there. Its header
// names the owner by username until their full name loads, so it may read either.
const expectMovedToNewest = async (page: Page, {marker, newestHeader}: {marker: string; newestHeader: string}) => {
  const headers = new Set([data.smokeUser, newestHeader])
  await expect.poll(async () => selectedInboxRows(page), {timeout: 15_000}).toEqual([data.smokeUser])
  await expect.poll(async () => headers.has(await threadHeaderTitle(page).innerText()), {timeout: 15_000}).toBe(true)
  await waitForRow(page, marker, 15_000)
  const seen = await watchSelection(page, 1_500)
  const [header, selected] = [seen.map(r => r.split(' | ')[0]!), seen.map(r => r.split(' | ')[1])]
  expect(new Set(selected), `the selected inbox row after the move: ${seen.join(', ')}`).toEqual(new Set([data.smokeUser]))
  expect(header.every(h => headers.has(h)), `the thread header after the move: ${seen.join(', ')}`).toBe(true)
}

test('leaving the open channel moves the selection to the newest conversation', async ({page}) => {
  test.setTimeout(150_000)
  const {topicName} = await createThrowawayChannel(leavePrefix)
  const newest = await openChannelAsSecond(page, topicName)

  const errors = collectConsoleErrors(page, notFromTheMove)
  await clickUnoccluded(page.locator('.icon-gen-iconfont-info:visible').first())
  const panel = page.getByTestId(T.CHAT_INFO_PANEL)
  await expect(panel).toBeVisible({timeout: 5_000})
  await clickUnoccluded(panel.getByText('Settings', {exact: true}))
  await clickUnoccluded(panel.getByText('Leave channel', {exact: true}))

  await expectMovedToNewest(page, newest)
  expect(errors.stop(), 'console errors after leaving').toEqual([])
})

test('removed from the open channel moves the selection to the newest conversation', async ({page}) => {
  test.setTimeout(150_000)
  const owner = requireAttachedApp(await findChannelOwner(data.smokeUser), "the owner's app")
  const {convID, topicName} = await createThrowawayChannel(removedPrefix)
  const newest = await openChannelAsSecond(page, topicName)

  const errors = collectConsoleErrors(page, notFromTheMove)
  await owner.removeFromChannel(convID, data.secondUser)

  await expectMovedToNewest(page, newest)
  expect(errors.stop(), 'console errors after the removal').toEqual([])
})

// A conversation opened from a link that the account has not joined has no inbox row. The service
// loads it, finds the conversation it last loaded missing from the inbox, and puts reselect info in
// the next inbox layout it sends. That speaks of a conversation the account cannot see in its inbox,
// not of one it has lost: the selection stays. As the second account, the link is one it sends
// itself in its conversation with the owner. While the selection is watched, fresh layouts are asked
// for as the app's own inbox refresh asks.
const openFromLinkThroughLayouts = async (page: Page, convID: string, link: string) => {
  await switchAccount(page, data.secondUser)
  await clickUnoccluded(inboxRow(page, data.smokeUser))
  await expect.poll(async () => selectedInboxRows(page), {timeout: 10_000}).toEqual([data.smokeUser])
  const marker = `e2e-selection-link-${Date.now()}`
  await sendDirectFromCli(data.direct.tlfName, `${marker} ${link}`)
  const ordinal = await waitForRow(page, marker, 20_000)

  const errors = collectConsoleErrors(page, notFromTheMove)
  await watchReselects(page, convID)
  let reselects: Awaited<ReturnType<typeof stopWatchingReselects>> | undefined
  const requested: Awaited<ReturnType<typeof stopWatchingReselects>> = []
  let seen: Array<string> | undefined
  try {
    await clickUnoccluded(rowByOrdinal(page, ordinal).getByText(link, {exact: true}))
    await expect.poll(async () => (await watchSelectedConversation(page, 1)).at(-1), {timeout: 10_000}).toBe(convID)
    const watching = watchSelectedConversation(page, 6_000)
    // fresh layouts while it is open, each asked for as the app's own inbox refresh does
    for (let i = 0; i < 3; i++) requested.push(await requestLayoutAndReadReselect(page, convID))
    seen = await watching
  } finally {
    reselects = [...(await stopWatchingReselects(page)), ...requested]
  }
  const namingIt = reselects.filter(r => r.named === convID)
  console.log(
    `inbox layouts with reselect info after opening the link: ${reselects
      .map(r => `naming ${r.named === convID ? 'it' : 'another'}${r.whileSelected ? ' while selected' : ''}, it having ${r.inboxRow ? 'a' : 'no'} row and ${r.meta} meta`)
      .join('; ')}`
  )
  expect(seen, 'the selected conversation after opening the link').toEqual([convID])
  expect(reselects.length, 'no inbox layout with reselect info came after opening the link').toBeGreaterThan(0)
  expect(errors.stop(), 'console errors after opening the link').toEqual([])
  return namingIt
}

// Its preview arrives with the link's lookup, so the app knows it from the start.
test('a channel the account has not joined, opened from a link, stays open through inbox layouts with reselect info', async ({page}) => {
  test.setTimeout(150_000)
  const {convID, topicName} = await createThrowawayChannel(unjoinedPrefix, {withSecond: false})
  await openFromLinkThroughLayouts(page, convID, `keybase://chat/${data.team}#${topicName}`)
  await expect(threadHeaderTitle(page)).toHaveText(`${data.team}#${topicName}`)
})

// The closed subteam's channel: the second account is not in its team at all, so the app knows
// nothing of it (no inbox row, no meta) all the while it is open.
test('a conversation the account never joined, opened from a link, does not bounce', async ({page}) => {
  test.setTimeout(150_000)
  const namingIt = await openFromLinkThroughLayouts(page, data.closedConvID, `keybase://convid/${data.closedConvID}`)
  // The service named it for reselection while it was open and the app knew nothing of it: a
  // selection with no inbox row and no meta, which a reselect used to move whatever it named.
  expect(
    namingIt.some(r => r.whileSelected && !r.inboxRow && r.meta === 'none'),
    'no layout named it for reselection while it was open and unknown to the app'
  ).toBe(true)
})
