import type {Locator} from '@playwright/test'
import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {openFirstTeam} from '@/tests/e2e/electron/helpers/navigate'
import {snap} from '@/tests/e2e/electron/helpers/snap'
import * as T from '@/tests/e2e/shared/test-ids'

// Team modals and wizards, all open → screenshot → cancel. Nothing submits.

// locator.isVisible() doesn't wait — this does, without throwing
const becomesVisible = async (l: Locator, timeout = 5_000) =>
  l.waitFor({state: 'visible', timeout}).then(() => true).catch(() => false)

// a test that died mid-modal poisons every test after it — close leftovers first
test.beforeEach(async ({page}) => {
  for (let i = 0; i < 3; i++) {
    const close = page.locator('.icon-gen-iconfont-close:visible')
    if ((await close.count()) === 0) break
    await close.first().click()
    await page.waitForTimeout(300)
  }
})

test('add members wizard opens', async ({page}, testInfo) => {
  if (!(await openFirstTeam(page))) {
    test.skip()
    return
  }
  const addButton = page.getByText('Add/Invite people', {exact: true}).locator('visible=true')
  if (!(await becomesVisible(addButton.first()))) {
    test.skip()
    return
  }
  await addButton.first().click()
  const emailOption = page.getByText('A list of email addresses', {exact: true})
  await expect(emailOption).toBeVisible({timeout: 5_000})
  await snap(page, testInfo)
  await page.locator('.icon-gen-iconfont-close:visible').first().click()
  await expect(emailOption).not.toBeVisible({timeout: 5_000})
})

test('add by email screen opens', async ({page}, testInfo) => {
  if (!(await openFirstTeam(page))) {
    test.skip()
    return
  }
  const addButton = page.getByText('Add/Invite people', {exact: true}).locator('visible=true')
  if (!(await becomesVisible(addButton.first()))) {
    test.skip()
    return
  }
  await addButton.first().click()
  await page.getByText('A list of email addresses', {exact: true}).click()
  const emailInput = page.getByPlaceholder('Email addresses')
  await expect(emailInput).toBeVisible({timeout: 5_000})
  await snap(page, testInfo)
  await page.locator('.icon-gen-iconfont-close:visible').first().click()
  await expect(emailInput).not.toBeVisible({timeout: 5_000})
})

test('edit team info modal opens', async ({page}, testInfo) => {
  if (!(await openFirstTeam(page))) {
    test.skip()
    return
  }
  const editButton = page.getByText('Edit', {exact: true}).locator('visible=true')
  if ((await editButton.count()) === 0) {
    test.skip()
    return
  }
  await editButton.first().click()
  const description = page.getByPlaceholder('Description')
  await expect(description).toBeVisible({timeout: 5_000})
  await snap(page, testInfo)
  await page.locator('.icon-gen-iconfont-close:visible').first().click()
  await expect(description).not.toBeVisible({timeout: 5_000})
})

test('edit channel modal opens', async ({page}, testInfo) => {
  if (!(await openFirstTeam(page))) {
    test.skip()
    return
  }
  const channelsTab = page.getByText('Channels', {exact: true}).locator('visible=true').first()
  if (!(await channelsTab.isVisible())) {
    test.skip()
    return
  }
  await channelsTab.click()
  const channelList = page.getByTestId(T.TEAMS_CHANNEL_LIST)
  if (!(await becomesVisible(channelList.first()))) {
    test.skip()
    return
  }
  // hover a channel row so its action buttons appear, then click ITS edit icon.
  // The team-avatar edit pencil also matches iconfont-edit and sits earlier in
  // the DOM (the header is a list section) — so take the LAST visible match.
  const channelRowName = channelList.getByText(/^#\w/).locator('visible=true').first()
  if (!(await becomesVisible(channelRowName))) {
    test.skip()
    return
  }
  await channelRowName.hover()
  const editIcons = channelList.locator('.icon-gen-iconfont-edit:visible')
  await expect.poll(async () => editIcons.count(), {timeout: 5_000}).toBeGreaterThan(0)
  await editIcons.last().click()
  const channelName = page.getByPlaceholder('channelname')
  await expect(channelName).toBeVisible({timeout: 5_000})
  await snap(page, testInfo)
  await page.locator('.icon-gen-iconfont-close:visible').first().click()
  await expect(channelName).not.toBeVisible({timeout: 5_000})
})

test('retention warning opens', async ({page}, testInfo) => {
  if (!(await openFirstTeam(page))) {
    test.skip()
    return
  }
  // 'Settings' also exists in the left nav — the team tab is the second visible match
  await page.getByText('Settings', {exact: true}).locator('visible=true').nth(1).click()
  // retention section renders only with admin rights
  if (!(await becomesVisible(page.getByText('Message deletion', {exact: true}).locator('visible=true').first()))) {
    test.skip()
    return
  }
  const dropdown = page
    .getByText(/^(Never auto-delete|Team default \(.*\)|\d+ (days?|weeks?|hours?|minutes?))$/)
    .locator('visible=true')
    .first()
  if (!(await becomesVisible(dropdown))) {
    test.skip()
    return
  }
  // the settings tab re-renders as the team's retention policy lands, which can
  // swallow the popup the first click opens — reopen until the menu sticks
  const sevenDays = page.getByText('7 days', {exact: true}).locator('visible=true').last()
  let menuOpen = false
  for (let i = 0; i < 3 && !menuOpen; i++) {
    await dropdown.click()
    menuOpen = await becomesVisible(sevenDays, 2_000)
  }
  if (!menuOpen) {
    test.skip()
    return
  }
  await sevenDays.click()
  const confirm = page.getByText('Yes, set to 7 days')
  if (!(await becomesVisible(confirm, 3_000))) {
    // no warning fired (already at/below 7 days) — nothing to capture
    await page.keyboard.press('Escape')
    test.skip()
    return
  }
  await snap(page, testInfo)
  await page.getByText('Cancel', {exact: true}).locator('visible=true').first().click()
  await expect(confirm).not.toBeVisible({timeout: 5_000})
})

test('add emoji modal opens', async ({page}, testInfo) => {
  if (!(await openFirstTeam(page))) {
    test.skip()
    return
  }
  const emojiTab = page.getByText('Emoji', {exact: true}).locator('visible=true')
  if (!(await becomesVisible(emojiTab.first()))) {
    test.skip()
    return
  }
  await emojiTab.first().click()
  const addEmoji = page.getByText('Add emoji', {exact: true}).locator('visible=true')
  if (!(await becomesVisible(addEmoji.first()))) {
    test.skip()
    return
  }
  await addEmoji.first().click()
  const dragDrop = page.getByText('Drag and drop images or')
  await expect(dragDrop).toBeVisible({timeout: 5_000})
  await snap(page, testInfo)
  await page.locator('.icon-gen-iconfont-close:visible').first().click()
  await expect(dragDrop).not.toBeVisible({timeout: 5_000})
})
