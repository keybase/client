// A team channel's membership and settings, changed from the app: joining a channel the account
// left, adding the second account to one, the minimum role to post, and the channel's own
// notification settings. Each acts on a throwaway channel this run made in the e2e team, reads the
// change back through the CLI or the main service, and deletes the channel after.
import type {Page} from '@playwright/test'
import {test, expect, seedChatData} from '@/tests/e2e/electron/helpers/fixtures'
import {clickUnoccluded, composerInput, openChannelWithRetries} from '@/tests/e2e/electron/helpers/chat'
import {withCleanup} from '@/tests/e2e/electron/helpers/cleanup'
import {openMenu} from '@/tests/e2e/electron/helpers/menu'
import {closeLeftoverModals} from '@/tests/e2e/electron/helpers/modal'
import {expectPersists} from '@/tests/e2e/electron/helpers/persisted'
import {retriedNavigation, step} from '@/tests/e2e/electron/helpers/step'
import {
  E2E_CHANNELS,
  channelMembersFromCli,
  createThrowawayChannel,
  deleteThrowawayChannel,
  leaveChannelFromCli,
  minWriterRoleFromCli,
  setMinWriterRoleFromCli,
  type ChatData,
} from '@/tests/e2e/shared/chat-data'
import {convIDBytes} from '@/tests/e2e/shared/conv-id'
import {mainConversation, mainRpc} from '@/tests/e2e/shared/main-rpc'
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
const modal = (page: Page) => page.locator('#modal-root')

const openInfoPanel = async (page: Page) => {
  if (!(await infoPanel(page).isVisible())) await infoButton(page).click()
  await expect(infoPanel(page)).toBeVisible({timeout: 5_000})
}

const closeInfoPanel = async (page: Page) => {
  // left open, it stays open in every conversation after
  if (await infoPanel(page).isVisible()) {
    await infoButton(page).click()
    await expect(infoPanel(page)).toHaveCount(0, {timeout: 5_000})
  }
}

const openThrowaway = async (page: Page, topicName: string) => openChannelWithRetries(page, data.team, topicName)

test.afterEach(async ({page}) => {
  await closeLeftoverModals(page)
  await closeInfoPanel(page)
})

test('join a channel smoke left', async ({page}, testInfo) => {
  test.setTimeout(150_000)
  const {topicName} = await createThrowawayChannel('join', {withSecond: false})
  await withCleanup(async () => {
    await leaveChannelFromCli(topicName)
    await expect
      .poll(async () => channelMembersFromCli(topicName), {message: 'the channel members after the CLI left', timeout: 15_000})
      .not.toContain(data.smokeUser)

    await openChannelWithRetries(page, data.team, E2E_CHANNELS.scratch)
    await openInfoPanel(page)
    const browse = menuItem(page, 'Browse all channels')
    // the placeholder ends with the filter's hotkey
    const filter = page.getByPlaceholder(/^Search \d+ channels?\b/)
    const join = page
      .getByText(`#${topicName}`, {exact: true})
      .locator('xpath=ancestor::div[.//*[normalize-space(text())="Join"]][1]')
      .getByText('Join', {exact: true})
    // the list draws membership from what the app last heard: until the leave reaches it, the row
    // still says In, so the list is closed and opened again
    await retriedNavigation(`Join offered for #${topicName}`, async () => {
      if (await filter.isVisible()) {
        await page.keyboard.press('Escape')
        await expect(filter).toHaveCount(0, {timeout: 5_000})
      }
      await openMenu(page, infoPanel(page).getByTestId(T.CHAT_INFO_PANEL_MENU_BUTTON), browse, 'the channel menu')
      await browse.click()
      await expect(filter).toBeVisible({timeout: 10_000})
      await filter.fill(topicName)
      // while the filter has focus the list hides its header row; the blur that a click on a row
      // would cause brings it back and moves the rows down under the pointer, so it blurs first
      await filter.blur()
      await expect(join, `Join beside #${topicName}`).toBeVisible({timeout: 3_000})
    }, {intervals: [2_000], timeout: 60_000})
    await step(page, testInfo, 'browse channels')
    await clickUnoccluded(join)
    await expect
      .poll(async () => channelMembersFromCli(topicName), {message: 'the channel members after Join', timeout: 15_000})
      .toContain(data.smokeUser)
    await step(page, testInfo, 'joined')
    await page.keyboard.press('Escape')
    await expect(filter).toHaveCount(0, {timeout: 5_000})

    await closeInfoPanel(page)
    await openThrowaway(page, topicName)
    await expect(composerInput(page), 'the composer of the joined channel').toBeEditable({timeout: 10_000})
  }, [async () => deleteThrowawayChannel(topicName)])
})

test('add second to a channel', async ({page}, testInfo) => {
  test.setTimeout(150_000)
  const {topicName} = await createThrowawayChannel('add', {withSecond: false})
  await withCleanup(async () => {
    expect(await channelMembersFromCli(topicName), 'the new channel starts without the second account').not.toContain(data.secondUser)
    await openThrowaway(page, topicName)
    await openInfoPanel(page)
    const toChannel = menuItem(page, 'To channel')
    await openMenu(page, infoPanel(page).getByText('Add people...', {exact: true}), toChannel, 'the add people menu')
    await toChannel.click()
    const filter = modal(page).getByPlaceholder(/^Search \d+ members?$/)
    await expect(filter).toBeVisible({timeout: 10_000})
    await filter.fill(data.secondUser)
    await clickUnoccluded(modal(page).getByText(data.secondUser, {exact: true}).first())
    const add = modal(page).getByText('Add 1 member', {exact: true})
    await expect(add).toBeVisible({timeout: 5_000})
    await step(page, testInfo, 'second picked')
    await clickUnoccluded(add)
    await expect(filter).toHaveCount(0, {timeout: 10_000})
    await expect
      .poll(async () => channelMembersFromCli(topicName), {message: 'the channel members after Add', timeout: 15_000})
      .toContain(data.secondUser)
    await step(page, testInfo, 'second added')
  }, [async () => deleteThrowawayChannel(topicName)])
})

test('min writer role', async ({page}, testInfo) => {
  test.setTimeout(150_000)
  const {topicName} = await createThrowawayChannel('minwrtr', {withSecond: false})
  await withCleanup(async () => {
    expect(await minWriterRoleFromCli(topicName), 'a new channel has no minimum role').toMatch(/\bnot set\b/i)
    await openThrowaway(page, topicName)
    await openInfoPanel(page)
    await infoPanel(page).getByTestId(T.CHAT_INFO_PANEL_SETTINGS_TAB).click()
    const label = infoPanel(page).getByText('Minimum role to post', {exact: true})
    await expect(label).toBeVisible({timeout: 5_000})
    // the dropdown sits under its label and shows the current role
    const dropdown = label.locator('xpath=ancestor::div[2]').locator('.icon-gen-iconfont-caret-down')
    const admin = menuItem(page, 'Admin')
    await openMenu(page, dropdown, admin, 'the minimum role menu')
    await admin.click()
    await expect.poll(async () => minWriterRoleFromCli(topicName), {message: 'the minimum role after picking Admin', timeout: 15_000}).toMatch(/\badmin\b/i)
    await step(page, testInfo, 'min writer admin')
  }, [
    // the menu offers no "none": the CLI clears it, and reads it back
    async () => setMinWriterRoleFromCli(topicName, 'none'),
    async () => deleteThrowawayChannel(topicName),
    async () => closeInfoPanel(page),
  ])
})

test.describe('notification settings', () => {
  // DeviceType.desktop, and NotificationKind generic / atmention, as the service keys them
  const desktop = '0'
  const generic = '0'
  const atmention = '1'
  const labels = {any: 'On any activity', mentions: 'Only when @mentioned', never: 'Never'} as const
  type Desktop = keyof typeof labels
  const savedDesktop = async (convID: string): Promise<Desktop> => {
    const settings = (await mainConversation(convID)).notifications?.settings?.[desktop]
    return settings?.[generic] ? 'any' : settings?.[atmention] ? 'mentions' : 'never'
  }
  // the desktop group's radio buttons come first, the mobile group's after
  const desktopRadio = (page: Page, which: Desktop) =>
    infoPanel(page).getByText(labels[which], {exact: true}).first().locator('xpath=ancestor::div[1]')
  const shownDesktop = async (page: Page): Promise<Desktop> => {
    for (const which of Object.keys(labels) as Array<Desktop>) {
      if ((await desktopRadio(page, which).locator('.radio-button.selected').count()) > 0) return which
    }
    throw new Error('no desktop notification option shows as selected')
  }
  const openNotifications = async (page: Page, topicName: string) => {
    await openThrowaway(page, topicName)
    await openInfoPanel(page)
    await infoPanel(page).getByTestId(T.CHAT_INFO_PANEL_SETTINGS_TAB).click()
    await expect(infoPanel(page).getByText('Desktop notifications', {exact: true})).toBeVisible({timeout: 5_000})
  }
  const pick = async (page: Page, convID: string, which: Desktop) => {
    await clickUnoccluded(desktopRadio(page, which))
    await expect.poll(async () => savedDesktop(convID), {message: `the saved desktop setting after picking ${which}`, timeout: 15_000}).toBe(which)
  }

  test('notification settings per conversation', async ({page}, testInfo) => {
    test.setTimeout(150_000)
    const {convID, topicName} = await createThrowawayChannel('notify', {withSecond: false})
    const original = await savedDesktop(convID)
    // put back through the service (the test itself puts it back through the panel): every setting
    // the conversation has is sent again, with the desktop pair as it was
    const restore = async () => {
      if ((await savedDesktop(convID)) === original) return
      const now = (await mainConversation(convID)).notifications
      const desktopKinds: Record<string, boolean> = {[atmention]: original !== 'never', [generic]: original === 'any'}
      const all = {...now?.settings, [desktop]: {...now?.settings?.[desktop], ...desktopKinds}}
      const settings = Object.entries(all).flatMap(([deviceType, kinds]) =>
        Object.entries(kinds).map(([kind, enabled]) => ({deviceType: Number(deviceType), enabled, kind: Number(kind)}))
      )
      await mainRpc('chat.1.local.setAppNotificationSettingsLocal', {channelWide: now?.channelWide ?? false, convID: convIDBytes(convID), settings})
      expect(await savedDesktop(convID), 'the desktop notification setting after the restore').toBe(original)
    }
    await withCleanup(async () => {
      expect(original, 'the desktop setting a new channel starts with').not.toBe('mentions')
      await openNotifications(page, topicName)
      expect(await shownDesktop(page), 'the desktop setting the panel shows').toBe(original)
      await pick(page, convID, 'mentions')
      await step(page, testInfo, 'desktop mentions')
      await expectPersists(
        page,
        async () => {
          await openNotifications(page, topicName)
          return shownDesktop(page)
        },
        'mentions',
        'the desktop notification setting'
      )
      // through the panel, as a user puts it back
      await pick(page, convID, original)
    }, [restore, async () => deleteThrowawayChannel(topicName), async () => closeInfoPanel(page)])
  })
})
