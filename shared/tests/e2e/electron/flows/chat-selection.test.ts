// Where the desktop's conversation selection goes when the open channel stops being the user's: the
// user leaves it, or the team owner removes them from it. Either way the selection moves to the
// newest conversation, and the thread shows that conversation without an error.
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
  selectedInboxRows,
  switchAccount,
  threadHeaderTitle,
  waitForRow,
  watchSelection,
} from '@/tests/e2e/electron/helpers/chat'
import {createThrowawayChannel, deleteThrowawayChannels, ensureChatData, sendDirectFromCli, type ChatData} from '@/tests/e2e/shared/chat-data'
import {cliWhoami} from '@/tests/e2e/shared/cli-account'
import {findChannelOwner, switchAttachedApp} from '@/tests/e2e/shared/incoming-sender'
import * as T from '@/tests/e2e/shared/test-ids'

const leavePrefix = 'e2e-leave'
const removedPrefix = 'e2e-kick'

// Known console noise across an account switch (see chat-data.test.ts's account switch flows).
const notFromTheMove = [/refreshAccounts|ignorePromise error/, /getUsernameToShow: message with no author/]

let data: ChatData

const requireOwnerCli = async () => {
  const who = await cliWhoami()
  if (who !== data.smokeUser) throw new Error('the desktop app and CLI must start as the smoke user (the team owner)')
}

test.beforeAll(async () => {
  test.setTimeout(10 * 60_000)
  data = await ensureChatData()
  await requireOwnerCli()
  await deleteThrowawayChannels(leavePrefix)
  await deleteThrowawayChannels(removedPrefix)
  // the owner's side of the removal flow
  await switchAttachedApp(data.smokeUser)
})

test.afterEach(async ({page}) => {
  await switchAccount(page, data.smokeUser)
  await requireOwnerCli()
  await deleteThrowawayChannels(leavePrefix)
  await deleteThrowawayChannels(removedPrefix)
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

// The selection is on the conversation with the owner, showing `marker`, and stays there.
const expectMovedToNewest = async (page: Page, {marker, newestHeader}: {marker: string; newestHeader: string}) => {
  await expect(threadHeaderTitle(page)).toHaveText(newestHeader, {timeout: 15_000})
  await waitForRow(page, marker, 15_000)
  const seen = await watchSelection(page, 1_500)
  expect(seen, 'the thread header and selected inbox row after the move').toEqual([`${newestHeader} | ${data.smokeUser}`])
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
  const owner = await findChannelOwner(data.smokeUser)
  if (!owner.ok) throw new Error(`the owner's app is unavailable: ${owner.reason}`)
  const {convID, topicName} = await createThrowawayChannel(removedPrefix)
  const newest = await openChannelAsSecond(page, topicName)

  const errors = collectConsoleErrors(page, notFromTheMove)
  await owner.removeFromChannel(convID, data.secondUser)

  await expectMovedToNewest(page, newest)
  expect(errors.stop(), 'console errors after the removal').toEqual([])
})
