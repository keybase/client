import type {Page, TestInfo} from '@playwright/test'
import {test, expect, e2eRunId} from '@/tests/e2e/electron/helpers/fixtures'
import {navigateToTeams, openE2ETeam} from '@/tests/e2e/electron/helpers/navigate'
import {stampedChannelName} from '@/tests/e2e/accounts/run-id'
import {step} from '@/tests/e2e/electron/helpers/step'
import * as T from '@/tests/e2e/shared/test-ids'
import {closeLeftoverModals, closeModal} from '@/tests/e2e/electron/helpers/modal'

// New-team wizard screens (view + cancel — team names are permanent, NEVER
// create) and a full channel create → delete cycle in the e2e team, with a channel named for the
// run so the sweeper clears one a crashed run leaves.
const CHANNEL = stampedChannelName('chan', e2eRunId())

test.beforeEach(async ({page}) => {
  await closeLeftoverModals(page)
})

test('team wizard purpose screen opens', async ({page}, testInfo) => {
  await navigateToTeams(page)
  await page.getByText('Create a team', {exact: true}).locator('visible=true').first().click()
  const prompt = page.getByText('What do you need a team for?')
  await expect(prompt).toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'team wizard purpose screen')
  await closeModal(page)
  await expect(prompt).not.toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'wizard closed')
})

test('team wizard name screen opens', async ({page}, testInfo) => {
  await navigateToTeams(page)
  await page.getByText('Create a team', {exact: true}).locator('visible=true').first().click()
  await page.getByText('Friends, family, or squad', {exact: true}).click()
  const nameInput = page.getByPlaceholder('Team name')
  await expect(nameInput).toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'team wizard name screen')
  // cancel the wizard — never actually create a team
  await closeModal(page)
  await expect(nameInput).not.toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'wizard closed')
})

async function openChannelsTab(page: Page): Promise<void> {
  await openE2ETeam(page)
  const channelsTab = page.getByText('Channels', {exact: true}).locator('visible=true').first()
  await expect(channelsTab).toBeVisible({timeout: 5_000})
  await channelsTab.click()
  await expect(page.getByTestId(T.TEAMS_CHANNEL_LIST).first()).toBeVisible({timeout: 5_000})
  // the list has loaded once it shows #general
  await expect(page.getByText('#general', {exact: true}).locator('visible=true').first(), 'the channel list to load').toBeVisible({
    timeout: 10_000,
  })
}

function channelRow(page: Page) {
  return page.getByText(`#${CHANNEL}`, {exact: true}).locator('visible=true')
}

// The confirm modal's title is the action too ("Delete channel"): its button is the Danger one.
const confirmDeleteButton = (page: Page) => page.locator('.button--type-Danger:visible', {hasText: 'Delete channel'})

// Creates the run's channel unless it is there already (a retry of the test that made it).
async function ensureChannel(page: Page, testInfo: TestInfo): Promise<void> {
  if ((await channelRow(page).count()) > 0) return
  await page.getByText('Create channel', {exact: true}).locator('visible=true').first().click()
  const nameInput = page.getByPlaceholder('Channel name')
  await expect(nameInput).toBeVisible({timeout: 5_000})
  await nameInput.fill(CHANNEL)
  await step(page, testInfo, 'channel name typed')
  await page.getByText('Save', {exact: true}).locator('visible=true').first().click()
  await expect(nameInput).not.toBeVisible({timeout: 15_000})
  // the channels list doesn't always live-refresh — re-enter the tab
  await openChannelsTab(page)
  await expect(channelRow(page).first()).toBeVisible({timeout: 30_000})
}

test('create channel modal opens', async ({page}, testInfo) => {
  test.setTimeout(60_000)
  await openChannelsTab(page)
  await page.getByText('Create channel', {exact: true}).locator('visible=true').first().click()
  const nameInput = page.getByPlaceholder('Channel name')
  await expect(nameInput).toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'create channel modal')
  await closeModal(page)
  await expect(nameInput).not.toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'modal closed')
})

test('created channel row renders', async ({page}, testInfo) => {
  test.setTimeout(60_000)
  await openChannelsTab(page)
  await ensureChannel(page, testInfo)
  await step(page, testInfo, 'channel row in list')
})

test('delete channel confirm renders, then channel is deleted', async ({page}, testInfo) => {
  test.setTimeout(60_000)
  await openChannelsTab(page)
  // run alone (or after the create test failed), it makes the channel it deletes
  await ensureChannel(page, testInfo)
  await channelRow(page).first().hover()
  await page.locator(`.icon-gen-iconfont-ellipsis:right-of(:text("#${CHANNEL}")):visible`).first().click()
  await page.getByText('Delete channel', {exact: true}).locator('visible=true').first().click()
  await expect(page.getByText(`Delete #${CHANNEL}?`)).toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'delete channel confirm')
  await confirmDeleteButton(page).click()
  await expect(page.getByText(`Delete #${CHANNEL}?`)).not.toBeVisible({timeout: 15_000})
  await openChannelsTab(page)
  await expect(channelRow(page)).toHaveCount(0, {timeout: 30_000})
  await step(page, testInfo, 'channel gone')
})
