import type {Locator, Page} from '@playwright/test'
import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {navigateToTeams, openFirstTeam} from '@/tests/e2e/electron/helpers/navigate'
import {snap} from '@/tests/e2e/electron/helpers/snap'
import * as T from '@/tests/e2e/shared/test-ids'

// New-team wizard screens (view + cancel — team names are permanent, NEVER
// create) and a full channel create → delete cycle in the first owned team.
const CHANNEL = 'e2e-vis-chan'

const becomesVisible = async (l: Locator, timeout = 5_000) =>
  l.waitFor({state: 'visible', timeout}).then(() => true).catch(() => false)

test.beforeEach(async ({page}) => {
  for (let i = 0; i < 3; i++) {
    const close = page.locator('.icon-gen-iconfont-close:visible')
    if ((await close.count()) === 0) break
    await close.first().click()
    await page.waitForTimeout(300)
  }
})

test('team wizard purpose screen opens', async ({page}, testInfo) => {
  await navigateToTeams(page)
  await page.getByText('Create a team', {exact: true}).locator('visible=true').first().click()
  const prompt = page.getByText('What do you need a team for?')
  await expect(prompt).toBeVisible({timeout: 5_000})
  await snap(page, testInfo)
  await page.locator('.icon-gen-iconfont-close:visible').first().click()
  await expect(prompt).not.toBeVisible({timeout: 5_000})
})

test('team wizard name screen opens', async ({page}, testInfo) => {
  await navigateToTeams(page)
  await page.getByText('Create a team', {exact: true}).locator('visible=true').first().click()
  await page.getByText('Friends, family, or squad', {exact: true}).click()
  const nameInput = page.getByPlaceholder('Team name')
  await expect(nameInput).toBeVisible({timeout: 5_000})
  await snap(page, testInfo)
  // cancel the wizard — never actually create a team
  await page.locator('.icon-gen-iconfont-close:visible').first().click()
  await expect(nameInput).not.toBeVisible({timeout: 5_000})
})

async function openChannelsTab(page: Page): Promise<boolean> {
  if (!(await openFirstTeam(page))) return false
  const channelsTab = page.getByText('Channels', {exact: true}).locator('visible=true').first()
  if (!(await becomesVisible(channelsTab))) return false
  await channelsTab.click()
  return becomesVisible(page.getByTestId(T.TEAMS_CHANNEL_LIST).first())
}

function channelRow(page: Page) {
  return page.getByText(`#${CHANNEL}`, {exact: true}).locator('visible=true')
}

async function deleteChannel(page: Page): Promise<void> {
  await channelRow(page).first().hover()
  await page.locator(`.icon-gen-iconfont-ellipsis:right-of(:text("#${CHANNEL}")):visible`).first().click()
  await page.getByText('Delete channel', {exact: true}).locator('visible=true').first().click()
  // wait for the confirm modal (its heading names the channel) so the menu item
  // is gone before clicking the identically-labelled confirm button
  await expect(page.getByText(`Delete #${CHANNEL}?`)).toBeVisible({timeout: 5_000})
  await page.getByText('Delete channel', {exact: true}).locator('visible=true').first().click()
  await expect(page.getByText(`Delete #${CHANNEL}?`)).not.toBeVisible({timeout: 15_000})
  // the channels list doesn't always live-refresh — re-enter the tab
  await openChannelsTab(page)
  await expect(channelRow(page)).toHaveCount(0, {timeout: 30_000})
}

test('create channel modal opens', async ({page}, testInfo) => {
  test.setTimeout(60_000)
  if (!(await openChannelsTab(page))) {
    test.skip()
    return
  }
  // self-heal: remove a leftover channel from a crashed previous run
  if ((await channelRow(page).count()) > 0) {
    await deleteChannel(page)
  }
  await page.getByText('Create channel', {exact: true}).locator('visible=true').first().click()
  const nameInput = page.getByPlaceholder('Channel name')
  await expect(nameInput).toBeVisible({timeout: 5_000})
  await snap(page, testInfo)
  await page.locator('.icon-gen-iconfont-close:visible').first().click()
  await expect(nameInput).not.toBeVisible({timeout: 5_000})
})

test('created channel row renders', async ({page}, testInfo) => {
  test.setTimeout(60_000)
  if (!(await openChannelsTab(page))) {
    test.skip()
    return
  }
  if ((await channelRow(page).count()) === 0) {
    await page.getByText('Create channel', {exact: true}).locator('visible=true').first().click()
    const nameInput = page.getByPlaceholder('Channel name')
    await expect(nameInput).toBeVisible({timeout: 5_000})
    await nameInput.fill(CHANNEL)
    await page.getByText('Save', {exact: true}).locator('visible=true').first().click()
    await expect(nameInput).not.toBeVisible({timeout: 15_000})
    // the channels list doesn't always live-refresh — re-enter the tab
    await openChannelsTab(page)
  }
  await expect(channelRow(page).first()).toBeVisible({timeout: 30_000})
  await snap(page, testInfo)
})

test('delete channel confirm renders, then channel is deleted', async ({page}, testInfo) => {
  test.setTimeout(60_000)
  if (!(await openChannelsTab(page))) {
    test.skip()
    return
  }
  if (!(await becomesVisible(channelRow(page).first(), 10_000))) {
    test.skip()
    return
  }
  await channelRow(page).first().hover()
  await page.locator(`.icon-gen-iconfont-ellipsis:right-of(:text("#${CHANNEL}")):visible`).first().click()
  await page.getByText('Delete channel', {exact: true}).locator('visible=true').first().click()
  await expect(page.getByText(`Delete #${CHANNEL}?`)).toBeVisible({timeout: 5_000})
  await snap(page, testInfo)
  await page.getByText('Delete channel', {exact: true}).locator('visible=true').first().click()
  await expect(page.getByText(`Delete #${CHANNEL}?`)).not.toBeVisible({timeout: 15_000})
  await openChannelsTab(page)
  await expect(channelRow(page)).toHaveCount(0, {timeout: 30_000})
})
