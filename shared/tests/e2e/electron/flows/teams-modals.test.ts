import type {Locator} from '@playwright/test'
import {test, expect, seedChatData} from '@/tests/e2e/electron/helpers/fixtures'
import {openE2ETeam} from '@/tests/e2e/electron/helpers/navigate'
import {manualEdge, step} from '@/tests/e2e/electron/helpers/step'
import * as T from '@/tests/e2e/shared/test-ids'
import {closeLeftoverModals, closeModal} from '@/tests/e2e/electron/helpers/modal'
import {E2E_CHANNELS} from '@/tests/e2e/shared/chat-data'

// Team modals and wizards in the e2e team, all open → screenshot → cancel. Nothing submits.

// locator.isVisible() doesn't wait — this does, without throwing
const becomesVisible = async (l: Locator, timeout = 5_000) =>
  l.waitFor({state: 'visible', timeout}).then(() => true).catch(() => false)

// Playwright only checks that a box held still for two animation frames before
// dispatching. On a cold load the team settings page reflows ~20px once the
// retention policy lands, which is enough to drop the click on the wrong row.
const settles = async (l: Locator, timeout = 5_000) => {
  const deadline = Date.now() + timeout
  let prev = ''
  while (Date.now() < deadline) {
    const box = await l.boundingBox()
    const cur = box ? `${Math.round(box.x)},${Math.round(box.y)}` : ''
    if (cur && cur === prev) return
    prev = cur
    await l.page().waitForTimeout(250)
  }
}

test.beforeAll(async () => {
  test.setTimeout(20 * 60_000) // a first run seeds the e2e channels; later runs only check
  await seedChatData()
})

// a test that died mid-modal poisons every test after it — close leftovers first
test.beforeEach(async ({page}) => {
  await closeLeftoverModals(page)
})

test('add members wizard opens', async ({page}, testInfo) => {
  await openE2ETeam(page)
  const addButton = page.getByText('Add/Invite people', {exact: true}).locator('visible=true')
  await expect(addButton.first(), 'Add/Invite people on the e2e team page (the smoke account owns it)').toBeVisible({timeout: 5_000})
  await addButton.first().click()
  const emailOption = page.getByText('A list of email addresses', {exact: true})
  await expect(emailOption).toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'add members wizard')
  await closeModal(page)
  await expect(emailOption).not.toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'wizard closed')
})

test('add by email screen opens', async ({page}, testInfo) => {
  await openE2ETeam(page)
  const addButton = page.getByText('Add/Invite people', {exact: true}).locator('visible=true')
  await expect(addButton.first(), 'Add/Invite people on the e2e team page (the smoke account owns it)').toBeVisible({timeout: 5_000})
  await addButton.first().click()
  await page.getByText('A list of email addresses', {exact: true}).click()
  const emailInput = page.getByPlaceholder('Email addresses')
  await expect(emailInput).toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'add by email screen')
  await manualEdge(page, testInfo, 'email-link')
  await closeModal(page)
  await expect(emailInput).not.toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'screen closed')
})

test('edit team info modal opens', async ({page}, testInfo) => {
  await openE2ETeam(page)
  const editButton = page.getByText('Edit', {exact: true}).locator('visible=true')
  await expect(editButton.first(), 'Edit on the e2e team page (the smoke account owns it)').toBeVisible({timeout: 5_000})
  await editButton.first().click()
  const description = page.getByPlaceholder('Description')
  await expect(description).toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'edit team info modal')
  await closeModal(page)
  await expect(description).not.toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'modal closed')
})

test('edit channel modal opens', async ({page}, testInfo) => {
  await openE2ETeam(page)
  const channelsTab = page.getByTestId(T.TEAMS_TAB_CHANNELS_BUTTON).locator('visible=true').first()
  await expect(channelsTab, 'the e2e team Channels tab').toBeVisible({timeout: 5_000})
  await channelsTab.click()
  await step(page, testInfo, 'channels tab')
  const channelList = page.getByTestId(T.TEAMS_CHANNEL_LIST)
  await expect(channelList.first(), 'the e2e team channel list').toBeVisible({timeout: 5_000})
  // hover the seeded e2e-scratch row so its action buttons appear, then click ITS edit icon: the
  // nearest one right of its name (other rows and the team avatar have edit icons too)
  const channelRowName = channelList.getByText(`#${E2E_CHANNELS.scratch}`, {exact: true}).locator('visible=true').first()
  await expect(channelRowName, `#${E2E_CHANNELS.scratch} in the e2e team channel list`).toBeVisible({timeout: 10_000})
  await channelRowName.hover()
  const editIcon = channelList.locator(`.icon-gen-iconfont-edit:visible:right-of(:text-is("#${E2E_CHANNELS.scratch}"))`).first()
  await expect(editIcon, `the edit icon on the #${E2E_CHANNELS.scratch} row`).toBeVisible({timeout: 5_000})
  await editIcon.click()
  const channelName = page.getByPlaceholder('channelname')
  await expect(channelName).toBeVisible({timeout: 5_000})
  await expect(channelName, 'the edit modal is for the hovered channel').toHaveValue(E2E_CHANNELS.scratch)
  await step(page, testInfo, 'edit channel modal', {card: true})
  await closeModal(page)
  await expect(channelName).not.toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'modal closed')
})

test('retention warning opens', async ({page}, testInfo) => {
  await openE2ETeam(page)
  await page.getByTestId(T.TEAMS_TAB_SETTINGS_BUTTON).locator('visible=true').first().click()
  await expect(
    page.getByText('Message deletion', {exact: true}).locator('visible=true').first(),
    'the e2e team settings to show the retention section (the smoke account owns the team)'
  ).toBeVisible({timeout: 5_000})
  // Picking a shorter policy only opens the warning; a longer one saves at once. The e2e team never
  // auto-deletes (its seeded channels depend on it), so 7 days is shorter and nothing is saved.
  const dropdown = page.getByText('Never auto-delete', {exact: true}).locator('visible=true').first()
  await expect(dropdown, 'the e2e team retention to be "Never auto-delete"; anything else and picking 7 days could save').toBeVisible({
    timeout: 5_000,
  })
  // the settings tab re-renders as the team's retention policy lands, which can
  // swallow the popup the first click opens — reopen until the menu sticks
  const sevenDays = page.getByText('7 days', {exact: true}).locator('visible=true').last()
  let menuOpen = false
  for (let i = 0; i < 3 && !menuOpen; i++) {
    await settles(dropdown)
    await dropdown.click()
    menuOpen = await becomesVisible(sevenDays, 2_000)
  }
  expect(
    menuOpen,
    'retention dropdown never opened its menu: no visible "7 days" option after 3 clicks on the message-deletion dropdown'
  ).toBe(true)
  await sevenDays.click()
  const confirm = page.getByText('Yes, set to 7 days')
  await expect(confirm, 'the retention warning for a shorter policy').toBeVisible({timeout: 3_000})
  await step(page, testInfo, 'retention warning')
  await page.getByText('Cancel', {exact: true}).locator('visible=true').first().click()
  await expect(confirm).not.toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'warning dismissed')
})

test('add emoji modal opens', async ({page}, testInfo) => {
  await openE2ETeam(page)
  const emojiTab = page.getByTestId(T.TEAMS_TAB_EMOJI_BUTTON).locator('visible=true')
  await expect(emojiTab.first(), 'the e2e team Emoji tab').toBeVisible({timeout: 5_000})
  await emojiTab.first().click()
  await step(page, testInfo, 'emoji tab')
  const addEmoji = page.getByText('Add emoji', {exact: true}).locator('visible=true')
  await expect(addEmoji.first(), 'Add emoji on the e2e team Emoji tab').toBeVisible({timeout: 5_000})
  await addEmoji.first().click()
  const dragDrop = page.getByText('Drag and drop images or')
  await expect(dragDrop).toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'add emoji modal', {card: true})
  await closeModal(page)
  await expect(dragDrop).not.toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'modal closed')
})
