// A subteam's channels made and edited from the app: a channel created with a description, then its
// name and description changed. Each test makes its own subteam of the e2e team and deletes it
// after, which takes its channels with it. (Deleting a channel is covered by team-wizard-channel.)
import type {Page} from '@playwright/test'
import {test, expect, e2eRunId} from '@/tests/e2e/electron/helpers/fixtures'
import {stampedChannelName} from '@/tests/e2e/accounts/run-id'
import {withCleanup} from '@/tests/e2e/electron/helpers/cleanup'
import {closeLeftoverModals} from '@/tests/e2e/electron/helpers/modal'
import {step} from '@/tests/e2e/electron/helpers/step'
import {
  conversationInfo,
  deleteSubteamIfPresent,
  makeSubteam,
  makeSubteamChannel,
  modalButton,
  modalRoot,
  openSubteamTab,
  teamChannels,
} from '@/tests/e2e/electron/helpers/teams'
import * as T from '@/tests/e2e/shared/test-ids'

test.use({actionTimeout: 10_000})

test.beforeEach(async ({page}) => {
  await closeLeftoverModals(page)
})
test.afterEach(async ({page}) => {
  await closeLeftoverModals(page)
})

const channelList = (page: Page) => page.getByTestId(T.TEAMS_CHANNEL_LIST).locator('visible=true').first()

test('create a channel with a description', async ({page}, testInfo) => {
  test.setTimeout(240_000)
  const {name} = await makeSubteam('chc')
  const channel = stampedChannelName('made', e2eRunId())
  const description = `e2e-${e2eRunId()}-topic of the channel`
  await withCleanup(async () => {
    // a team with one channel offers to create several at once; with two, one at a time
    await makeSubteamChannel(name, stampedChannelName('seed', e2eRunId()))
    await openSubteamTab(page, name, T.TEAMS_TAB_CHANNELS_BUTTON)
    await page.getByText('Create channel', {exact: true}).locator('visible=true').first().click()
    const nameInput = modalRoot(page).getByPlaceholder('Channel name')
    await expect(nameInput).toBeVisible({timeout: 10_000})
    await nameInput.fill(channel)
    await modalRoot(page).getByPlaceholder('Add a description or topic...').fill(description)
    await step(page, testInfo, 'channel and description typed')
    await modalButton(page, 'Save').click()
    await expect(nameInput).toHaveCount(0, {timeout: 20_000})
    await expect.poll(async () => (await teamChannels(name)).has(channel), {message: `#${channel} in the subteam`, timeout: 30_000}).toBe(true)
    const convID = (await teamChannels(name)).get(channel) ?? ''
    await expect.poll(async () => (await conversationInfo(convID)).headline, {message: `#${channel} description`, timeout: 30_000}).toBe(description)
    await openSubteamTab(page, name, T.TEAMS_TAB_CHANNELS_BUTTON)
    await expect(channelList(page).getByText(`#${channel}`, {exact: true}), `#${channel} in the channels tab`).toBeVisible({timeout: 30_000})
    await step(page, testInfo, 'channel created')
  }, [async () => deleteSubteamIfPresent(name)])
})

test('edit its name and description', async ({page}, testInfo) => {
  test.setTimeout(240_000)
  const {name} = await makeSubteam('che')
  const channel = stampedChannelName('before', e2eRunId())
  const renamed = stampedChannelName('after', e2eRunId())
  const description = `e2e-${e2eRunId()}-edited topic`
  await withCleanup(async () => {
    const convID = await makeSubteamChannel(name, channel)
    await openSubteamTab(page, name, T.TEAMS_TAB_CHANNELS_BUTTON)
    const row = channelList(page).getByText(`#${channel}`, {exact: true}).first()
    await expect(row, `#${channel} in the channels tab`).toBeVisible({timeout: 30_000})
    await row.hover()
    await channelList(page).locator(`.icon-gen-iconfont-edit:visible:right-of(:text-is("#${channel}"))`).first().click()
    const nameInput = modalRoot(page).getByPlaceholder('channelname')
    await expect(nameInput, 'the edit modal is for the hovered channel').toHaveValue(channel, {timeout: 10_000})
    await nameInput.fill(renamed)
    await modalRoot(page).getByPlaceholder('Description').fill(description)
    await step(page, testInfo, 'channel edited')
    await modalButton(page, 'Save').click()
    await expect(nameInput).toHaveCount(0, {timeout: 20_000})
    await expect
      .poll(async () => conversationInfo(convID), {message: 'the channel after Save', timeout: 30_000})
      .toEqual(expect.objectContaining({headline: description, topicName: renamed}))
    await expect.poll(async () => (await teamChannels(name)).get(renamed), {message: `#${renamed} through the CLI`, timeout: 30_000}).toBe(convID)
    await step(page, testInfo, 'channel renamed')
  }, [async () => deleteSubteamIfPresent(name)])
})
