// Blocking the second account from the smoke account's conversation with it, and unblocking it
// from its profile. Nothing here ever reports: the block modal's report option is checked to be off
// before Finish, and the report submit is a manual edge. The blocks, and the conversation's status,
// are put back in finally and read back through the main service; the e2e accounts' own check runs
// after.
import {execFile} from 'child_process'
import type {Page} from '@playwright/test'
import {test, expect, seedChatData} from '@/tests/e2e/electron/helpers/fixtures'
import {clickUnoccluded, inboxRow, openDirectConversation, openUserProfile, scrollInboxTo} from '@/tests/e2e/electron/helpers/chat'
import {withCleanup} from '@/tests/e2e/electron/helpers/cleanup'
import {pairFavoriteState, refavoritePair} from '@/tests/e2e/electron/helpers/files'
import {closeLeftoverModals} from '@/tests/e2e/electron/helpers/modal'
import {manualEdge, step} from '@/tests/e2e/electron/helpers/step'
import {type ChatData} from '@/tests/e2e/shared/chat-data'
import {conversationStatus, mainConversation, mainRpc, restoreConversationStatus} from '@/tests/e2e/shared/main-rpc'
import * as T from '@/tests/e2e/shared/test-ids'

test.describe.configure({mode: 'serial'})
test.use({actionTimeout: 10_000})

let data: ChatData

test.beforeAll(async () => {
  test.setTimeout(20 * 60_000) // a first run seeds; later runs only check
  data = await seedChatData()
})

type Blocks = {chatBlocked: boolean; followBlocked: boolean}
const blocksOf = async (username: string): Promise<Blocks> => {
  const res = await mainRpc<Array<{username: string} & Blocks> | null>('keybase.1.user.getUserBlocks', {sessionID: 0, usernames: [username]})
  const b = res?.find(r => r.username === username)
  return {chatBlocked: !!b?.chatBlocked, followBlocked: !!b?.followBlocked}
}
const unblocked: Blocks = {chatBlocked: false, followBlocked: false}

const infoPanel = (page: Page) => page.getByTestId(T.CHAT_INFO_PANEL)
const infoButton = (page: Page) => page.locator('.icon-gen-iconfont-info:visible').first()
const finishButton = (page: Page) => page.getByText('Finish', {exact: true})
// shown under the report option while it is on: a second guard beside the option's own state
const reportOptions = (page: Page) => page.getByText('We will review this report within 24 hours and take an action', {exact: true})

// The report option must be off before Finish. Its row carries its state; when it shows on it is
// turned off, and both its state and the report details are checked again.
const requireReportOff = async (page: Page, username: string) => {
  const on = page.getByTestId(T.CHAT_BLOCK_REPORT_ON)
  const off = page.getByTestId(T.CHAT_BLOCK_REPORT_OFF)
  await expect(on.or(off), 'the report option in the block modal').toHaveCount(1, {timeout: 10_000})
  if ((await on.count()) > 0) await on.getByText(`Report ${username} to Keybase admins`, {exact: true}).click()
  await expect(off, 'the report option is off').toHaveCount(1, {timeout: 5_000})
  await expect(on, 'the report option is not on').toHaveCount(0)
  await expect(reportOptions(page), 'the report details are not shown').toHaveCount(0)
}

// Unblocks from the profile's Manage blocking, leaving the report option off.
const unblockFromProfile = async (page: Page, username: string) => {
  await openUserProfile(page, username)
  await page.getByText('Manage blocking', {exact: true}).locator('visible=true').first().click()
  await expect(finishButton(page)).toBeVisible({timeout: 10_000})
  const now = await blocksOf(username)
  if (now.chatBlocked) await page.getByText(`Block ${username}`, {exact: true}).click()
  if (now.followBlocked) await page.getByText(`Hide ${username} from your followers`, {exact: true}).click()
  await requireReportOff(page, username)
  await clickUnoccluded(finishButton(page))
  await expect(finishButton(page)).toHaveCount(0, {timeout: 15_000})
  await expect.poll(async () => blocksOf(username), {message: 'the blocks after unblocking from the profile', timeout: 15_000}).toEqual(unblocked)
}

// Unblocks from the profile, as a user does. When that fails the second account is unblocked through
// the main service instead and read back, and the test still fails with the profile's error.
const unblock = async (page: Page, username: string) => {
  try {
    await closeLeftoverModals(page)
    await unblockFromProfile(page, username)
  } catch (e) {
    try {
      await mainRpc('keybase.1.user.setUserBlocks', {blocks: [{setChatBlock: false, setFollowBlock: false, username}], sessionID: 0})
      await expect.poll(async () => blocksOf(username), {message: 'the blocks after unblocking through the main service', timeout: 15_000}).toEqual(unblocked)
    } catch (r) {
      throw new AggregateError([e, r], `unblocking from the profile failed: ${String(e)}; and through the main service: ${String(r)}`, {cause: r})
    }
    throw new Error(`unblocking from the profile failed (unblocked through the main service instead): ${String(e)}`, {cause: e})
  }
}

const accountsCheck = async () =>
  new Promise<string>((resolve, reject) => {
    execFile(
      process.execPath,
      ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', 'tests/e2e/accounts/setup.mts', '--check'],
      {encoding: 'utf8', timeout: 120_000},
      (err, stdout, stderr) => (err ? reject(new Error(`accounts:setup --check failed: ${stdout}${stderr}`)) : resolve(stdout))
    )
  })

test('block second from the DM, then unblock', async ({page}, testInfo) => {
  test.setTimeout(240_000)
  const {secondUser} = data
  const {convID} = data.direct
  expect(await blocksOf(secondUser), 'the second account starts unblocked (a failed unblock leaves it blocked)').toEqual(unblocked)
  const originalStatus = (await mainConversation(convID)).info.status
  expect(originalStatus, 'the conversation starts unfiled').toBe(conversationStatus.unfiled)
  // blocking ignores the smoke+second folder, and unblocking leaves it ignored
  const originalFolder = await pairFavoriteState()
  await withCleanup(async () => {
    await openDirectConversation(page, secondUser)
    if (!(await infoPanel(page).isVisible())) await infoButton(page).click()
    await infoPanel(page).getByTestId(T.CHAT_INFO_PANEL_SETTINGS_TAB).click()
    await infoPanel(page).getByText('Block', {exact: true}).first().click()
    await expect(finishButton(page)).toBeVisible({timeout: 10_000})
    await requireReportOff(page, secondUser)
    await manualEdge(page, testInfo, 'block-report-submit')
    await clickUnoccluded(finishButton(page))
    await expect(finishButton(page)).toHaveCount(0, {timeout: 15_000})

    await expect.poll(async () => (await blocksOf(secondUser)).chatBlocked, {message: 'the second account is chat blocked', timeout: 15_000}).toBe(true)
    await expect
      .poll(async () => (await mainConversation(convID)).info.status, {message: 'the conversation status after the block', timeout: 15_000})
      .toBe(conversationStatus.blocked)
    // a blocked conversation leaves the inbox; the self conversation beside it shows the inbox is in
    await scrollInboxTo(page, inboxRow(page, data.smokeUser), 'the self conversation')
    await expect(inboxRow(page, secondUser), 'the blocked conversation in the inbox').toHaveCount(0, {timeout: 10_000})
    await step(page, testInfo, 'blocked')
  }, [
    // whatever the body did, the second account is never left blocked
    async () => {
      if (JSON.stringify(await blocksOf(secondUser)) === JSON.stringify(unblocked)) return
      await unblock(page, secondUser)
      await step(page, testInfo, 'unblocked')
    },
    async () => {
      if ((await mainConversation(convID)).info.status === originalStatus) return
      await restoreConversationStatus(convID, originalStatus)
      await expect
        .poll(async () => (await mainConversation(convID)).info.status, {message: 'the restored conversation status', timeout: 15_000})
        .toBe(originalStatus)
    },
    async () => {
      if (!originalFolder.favorite) return
      // the block's ignore can land after the unblock: let the folder's state settle first
      let last = ''
      await expect
        .poll(
          async () => {
            const now = JSON.stringify(await pairFavoriteState())
            const settled = now === last
            last = now
            return settled
          },
          {intervals: [1_000], message: 'the smoke+second folder favorite state settling', timeout: 15_000}
        )
        .toBe(true)
      if (!(await pairFavoriteState()).favorite) await refavoritePair()
      expect(await pairFavoriteState(), 'the smoke+second folder after the restore').toEqual({favorite: true, ignored: false})
    },
    accountsCheck,
    async () => {
      await closeLeftoverModals(page)
      await openDirectConversation(page, secondUser)
      if (await infoPanel(page).isVisible()) await infoButton(page).click()
      await expect(infoPanel(page)).toHaveCount(0, {timeout: 5_000})
    },
  ])
})
