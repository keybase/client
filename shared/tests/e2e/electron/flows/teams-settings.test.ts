// A subteam's settings changed from the app: its description, featuring it on the smoke account's
// profile, access requests, its avatar, the team's and a channel's message deletion, and its default
// channels. Each test makes its own subteam of the e2e team (nothing here touches the e2e team's own
// settings), reads each change back through the main service, restores what it changed, and deletes
// the subteam after.
import type {Page, TestInfo} from '@playwright/test'
import {test, expect, e2eRunId} from '@/tests/e2e/electron/helpers/fixtures'
import {stampedChannelName} from '@/tests/e2e/accounts/run-id'
import {clickUnoccluded, openChannelWithRetries, waitEnabledSteady, waitSteady, watchOutgoingRpcs} from '@/tests/e2e/electron/helpers/chat'
import {withCleanup} from '@/tests/e2e/electron/helpers/cleanup'
import {dropFiles} from '@/tests/e2e/electron/helpers/drop'
import {openMenu} from '@/tests/e2e/electron/helpers/menu'
import {closeLeftoverModals} from '@/tests/e2e/electron/helpers/modal'
import {openE2ESubteam, openOwnProfile} from '@/tests/e2e/electron/helpers/navigate'
import {expectPersists} from '@/tests/e2e/electron/helpers/persisted'
import {step} from '@/tests/e2e/electron/helpers/step'
import {
  checkMarkShown,
  confirmDanger,
  deleteSubteamIfPresent,
  makeSubteam,
  makeSubteamChannel,
  menuItem,
  modalButton,
  modalRoot,
  openSubteamTab,
  zoomAvatarCrop,
  mainRead,
  teamID,
} from '@/tests/e2e/electron/helpers/teams'
import {CORPUS_DIR} from '@/tests/e2e/fixtures/corpus/corpus'
import {convIDBytes} from '@/tests/e2e/shared/conv-id'
import * as T from '@/tests/e2e/shared/test-ids'

test.use({actionTimeout: 10_000})

test.beforeEach(async ({page}) => {
  await closeLeftoverModals(page)
})
test.afterEach(async ({page}) => {
  await closeLeftoverModals(page)
})

const settingsTab = (page: Page) => page.getByTestId(T.TEAMS_SETTINGS_TAB).locator('visible=true').first()

const openSettings = async (page: Page, subteam: string) => {
  await openSubteamTab(page, subteam, T.TEAMS_TAB_SETTINGS_BUTTON)
  // the tab has loaded once its retention picker shows the policy
  await expect(settingsTab(page).getByText('Message deletion', {exact: true}).first()).toBeVisible({timeout: 15_000})
}

// A labelled checkbox of the settings tab, and whether it shows checked (an unchecked box hides its
// check mark).
const checkbox = (page: Page, label: string) =>
  settingsTab(page).locator('div').filter({has: page.getByText(label, {exact: true})}).filter({has: page.locator('.icon-gen-iconfont-check')}).last()
const shownChecked = async (page: Page, label: string) => checkMarkShown(checkbox(page, label).locator('.icon-gen-iconfont-check').first())

type Showcase = {isMemberShowcased: boolean; teamShowcase: {description?: string | null; isShowcased: boolean}}
const showcase = async (subteam: string) => {
  const id = await teamID(subteam)
  return mainRead<Showcase>('keybase.1.teams.getTeamAndMemberShowcase', {teamID: id})
}

test('description', async ({page}, testInfo) => {
  test.setTimeout(240_000)
  const {name} = await makeSubteam('dsc')
  const description = `e2e-${e2eRunId()}-description`
  await withCleanup(async () => {
    expect((await showcase(name)).teamShowcase.description ?? '', 'a new subteam has no description').toBe('')
    await openE2ESubteam(page, name, 'the subteam this test made')
    await page.getByText('Edit', {exact: true}).locator('visible=true').first().click()
    const input = modalRoot(page).getByPlaceholder('Description')
    await expect(input).toBeVisible({timeout: 10_000})
    await input.fill(description)
    await step(page, testInfo, 'description typed')
    await modalButton(page, 'Save').click()
    await expect.poll(async () => (await showcase(name)).teamShowcase.description, {message: 'the saved description', timeout: 30_000}).toBe(description)
    // the modal closes itself only when it sees the save in flight, which a quick save can finish
    // before it looks (an owner-report finding): it is closed here when it stayed
    await closeLeftoverModals(page)
    await expect(page.getByText(description, {exact: true}).locator('visible=true').first(), 'the description on the team page').toBeVisible({
      timeout: 15_000,
    })
    await step(page, testInfo, 'description saved')
  }, [async () => deleteSubteamIfPresent(name)])
})

const showcaseLabel = 'Feature team on your own profile'
const profileTeams = (p: Page) => p.getByTestId(T.PROFILE_PAGE).locator('visible=true').first()

// Makes a subteam, runs `body` with it, and after (pass or fail) takes it off the smoke account's
// profile again if it is featured there, reading back that it is not, then deletes it.
const withShowcaseSubteam = async (page: Page, prefix: string, body: (name: string, featured: () => Promise<boolean>) => Promise<void>) => {
  const {name} = await makeSubteam(prefix)
  const featured = async () => (await showcase(name)).isMemberShowcased
  // Off again from the profile's featured teams, which reads the setting from the teams list.
  const unfeature = async () => {
    // the teams in the modal come from the teams list, which can still show the subteam as not
    // featured right after it was: the modal is opened again until it shows it featured
    const button = modalRoot(page)
      .locator('div')
      .filter({has: page.getByText(name, {exact: true})})
      .filter({has: page.locator('.button--primary, .button--secondary')})
      .last()
      .locator('.button--primary, .button--secondary')
    await expect(async () => {
      await closeLeftoverModals(page)
      await openOwnProfile(page)
      await clickUnoccluded(profileTeams(page).locator('.icon-gen-iconfont-edit:right-of(:text-is("Featured teams"))').first())
      await expect(button, 'the subteam among the teams to feature').toHaveCount(1, {timeout: 15_000})
      await button.scrollIntoViewIfNeeded()
      await expect(button, 'the subteam shown as featured').toHaveText('Featured', {timeout: 5_000})
    }, 'the subteam featured in the featured teams modal').toPass({intervals: [2_000], timeout: 90_000})
    // the list redraws while the teams list reloads, and a press on the replaced row lands on
    // nothing: the one press waits until the row has settled, still reading Featured, with the
    // service agreeing. The button keeps its label while any call holds the team's waiting key
    // (a team setting still saving), and a press then does nothing, so it also waits until the
    // button has stayed enabled.
    await waitSteady(button, "the subteam's Featured button", 1_500)
    expect(await featured(), 'featured on the profile before Featured is pressed').toBe(true)
    await waitEnabledSteady(button, "the subteam's Featured button", 1_500, 30_000)
    await expect(button, 'the subteam shown as featured, settled').toHaveText('Featured', {timeout: 1_000})
    const rpcs = await watchOutgoingRpcs(page)
    try {
      await clickUnoccluded(button)
      await expect
        .poll(() => rpcs.seen().some(c => c.method === 'keybase.1.teams.setTeamMemberShowcase' && c.params.includes('isShowcased: false')), {
          message: 'the press on Featured sent the unfeature',
          timeout: 5_000,
        })
        .toBe(true)
    } finally {
      await rpcs.stop()
    }
    await expect.poll(featured, {message: 'featured on the profile after Featured', timeout: 30_000}).toBe(false)
    await closeLeftoverModals(page)
  }
  await withCleanup(
    async () => {
      expect(await featured(), 'a new subteam is not featured on the profile').toBe(false)
      await body(name, featured)
    },
    [
      async () => {
        if (await featured()) await unfeature()
        expect(await featured(), 'featured on the profile after the restore').toBe(false)
      },
      async () => deleteSubteamIfPresent(name),
    ]
  )
}

test('showcase on my profile', async ({page}, testInfo) => {
  test.setTimeout(300_000)
  await withShowcaseSubteam(page, 'shw', async (name, featured) => {
    await openSettings(page, name)
    // disabled until the app's teams list has the subteam, which the tab asks for
    await expect(checkbox(page, showcaseLabel), 'the box enabled').toHaveCSS('cursor', 'pointer', {timeout: 15_000})
    await clickUnoccluded(settingsTab(page).getByText(showcaseLabel, {exact: true}))
    await expect.poll(featured, {message: 'featured on the profile after the check', timeout: 30_000}).toBe(true)
    await step(page, testInfo, 'featured')
    await openOwnProfile(page)
    await expect(profileTeams(page).getByText(name, {exact: true}).first(), 'the subteam on the profile').toBeVisible({timeout: 20_000})
    await step(page, testInfo, 'on the profile')
  })
})

// The settings box shows the setting and turns it off again.
test('showcase box shows the setting and turns it off', async ({page}, testInfo) => {
  test.setTimeout(300_000)
  await withShowcaseSubteam(page, 'shb', async (name, featured) => {
    await openSettings(page, name)
    // disabled until the app's teams list has the subteam, which the tab asks for
    await expect(checkbox(page, showcaseLabel), 'the box enabled').toHaveCSS('cursor', 'pointer', {timeout: 15_000})
    expect(await shownChecked(page, showcaseLabel), 'the box before').toBe(false)
    await clickUnoccluded(settingsTab(page).getByText(showcaseLabel, {exact: true}))
    await expect.poll(featured, {message: 'featured on the profile after the check', timeout: 30_000}).toBe(true)
    await expect.poll(async () => shownChecked(page, showcaseLabel), {message: 'the box after the check', timeout: 15_000}).toBe(true)
    await step(page, testInfo, 'box checked')
    await clickUnoccluded(settingsTab(page).getByText(showcaseLabel, {exact: true}))
    await expect.poll(featured, {message: 'featured on the profile after the uncheck', timeout: 30_000}).toBe(false)
    await expect.poll(async () => shownChecked(page, showcaseLabel), {message: 'the box after the uncheck', timeout: 15_000}).toBe(false)
    await step(page, testInfo, 'box unchecked')
  })
})

test('allow access requests', async ({page}, testInfo) => {
  test.setTimeout(240_000)
  const {name} = await makeSubteam('tar')
  const label = "Don't allow requests to join this team"
  const tarsDisabled = async () => mainRead<boolean>('keybase.1.teams.getTarsDisabled', {teamID: await teamID(name)})
  await withCleanup(async () => {
    expect(await tarsDisabled(), 'a new subteam allows requests').toBe(false)
    await openSettings(page, name)
    expect(await shownChecked(page, label)).toBe(false)
    await clickUnoccluded(settingsTab(page).getByText(label, {exact: true}))
    await expect.poll(tarsDisabled, {message: 'requests disabled after the check', timeout: 30_000}).toBe(true)
    await step(page, testInfo, 'requests disabled')
    await expectPersists(
      page,
      async () => {
        await openSettings(page, name)
        // the box draws unchecked until the team's settings load
        await expect.poll(async () => shownChecked(page, label), {timeout: 15_000}).toBe(true)
        return shownChecked(page, label)
      },
      true,
      'the "don\'t allow requests" box'
    )
    await clickUnoccluded(settingsTab(page).getByText(label, {exact: true}))
    await expect.poll(tarsDisabled, {message: 'requests allowed again', timeout: 30_000}).toBe(false)
    await step(page, testInfo, 'requests allowed again')
  }, [async () => deleteSubteamIfPresent(name)])
})

// The team page header's avatar draws its image from the app's local avatar server; the URL's
// count goes up each time the app hears the avatar changed. Only the count is read: the URL also
// carries the server's token.
const headerAvatarCount = async (page: Page) => {
  const style = await page.locator('.avatar.avatar-team-size-96 .avatar-user-image').locator('visible=true').first().getAttribute('style')
  return /[?&]count=(\d+)/.exec(style ?? '')?.[1] ?? ''
}

// Picks `file` as the subteam's avatar from its team page, zooming the crop first when `zoom`, and
// saves it; then the service's avatar for the subteam and the team page's image both change.
const changeAvatar = async (page: Page, testInfo: TestInfo, prefix: string, file: string, zoom: boolean) => {
  const {name} = await makeSubteam(prefix)
  const avatarUrl = async () => {
    const res = await mainRead<{picmap?: Record<string, Record<string, string>> | null}>('keybase.1.avatars.loadTeamAvatars', {
      formats: ['square_192'],
      names: [name],
    })
    return res.picmap?.[name]?.['square_192'] ?? ''
  }
  await withCleanup(async () => {
    const before = await avatarUrl()
    await openE2ESubteam(page, name, 'the subteam this test made')
    const countBefore = await headerAvatarCount(page)
    expect(countBefore, "the team page avatar's image").not.toBe('')
    await clickUnoccluded(page.locator('.icon-gen-iconfont-edit:visible').first())
    const dropZone = modalRoot(page).getByText('Drag and drop a team avatar or', {exact: false})
    await expect(dropZone).toBeVisible({timeout: 10_000})
    // the picker is the page's own file input, not a native dialog: the image is dropped instead
    await dropFiles(page, modalRoot(page).locator('.icon-gen-iconfont-camera').first(), [file])
    await expect(modalRoot(page).getByText('Click to select. Scroll to zoom.', {exact: true})).toBeVisible({timeout: 15_000})
    if (zoom) {
      await zoomAvatarCrop(page)
    }
    await step(page, testInfo, zoom ? 'avatar zoomed' : 'avatar picked')
    await modalButton(page, 'Save').click()
    await expect(dropZone).toHaveCount(0, {timeout: 30_000})
    await expect.poll(avatarUrl, {message: 'the subteam avatar after Save', timeout: 60_000}).not.toBe(before)
    await expect.poll(async () => headerAvatarCount(page), {message: "the team page avatar's image after Save", timeout: 30_000}).not.toBe(countBefore)
    await step(page, testInfo, 'avatar saved')
  }, [async () => deleteSubteamIfPresent(name)])
}

// The default path: pick an image and save it as it is shown.
test('avatar', async ({page}, testInfo) => {
  test.setTimeout(240_000)
  await changeAvatar(page, testInfo, 'avt', `${CORPUS_DIR}/e2e-c.png`, false)
})

test('avatar after zooming the crop', async ({page}, testInfo) => {
  test.setTimeout(240_000)
  await changeAvatar(page, testInfo, 'avz', `${CORPUS_DIR}/e2e-c-large.png`, true)
})

// RetentionPolicyType in the protocol
const retain = 1
const inherit = 3
const thirtyDays = 30 * 24 * 60 * 60
type Policy = {typ: number; expire?: {age: number} | null} | null

// Picks `title` from a retention dropdown; a shorter policy than the current one asks to confirm.
const pickRetention = async (page: Page, dropdown: ReturnType<Page['locator']>, title: string, confirm: boolean) => {
  const item = menuItem(page, title)
  await openMenu(page, dropdown, item, 'the message deletion menu')
  await item.click()
  if (confirm) {
    await expect(modalRoot(page).getByText(/^I understand that existing messages older than/).first(), 'the retention warning').toBeVisible({timeout: 10_000})
    await clickUnoccluded(modalRoot(page).getByText(/^I understand that existing messages older than/).first())
    await confirmDanger(page, `Yes, set to ${title}`)
  }
}

test('team retention', async ({page}, testInfo) => {
  test.setTimeout(240_000)
  const {name} = await makeSubteam('ret')
  const policy = async () => mainRead<Policy>('chat.1.local.getTeamRetentionLocal', {teamID: await teamID(name)})
  // the dropdown shows the current policy
  const dropdown = (p: Page, shows: string) => settingsTab(p).getByText(shows, {exact: true}).first()
  await withCleanup(async () => {
    const original = await policy()
    expect(original?.typ ?? retain, 'a new subteam never deletes').toBe(retain)
    await openSettings(page, name)
    await pickRetention(page, dropdown(page, 'Never auto-delete'), '30 days', true)
    await expect.poll(async () => (await policy())?.expire?.age, {message: 'the team policy after 30 days', timeout: 30_000}).toBe(thirtyDays)
    await step(page, testInfo, '30 days')
    await pickRetention(page, dropdown(page, '30 days'), 'Never auto-delete', false)
    await expect.poll(async () => (await policy())?.typ, {message: 'the team policy after Never', timeout: 30_000}).toBe(retain)
    await step(page, testInfo, 'never again')
  }, [async () => deleteSubteamIfPresent(name)])
})

test('channel retention', async ({page}, testInfo) => {
  test.setTimeout(240_000)
  const {name} = await makeSubteam('cre')
  const channel = stampedChannelName('ret', e2eRunId())
  let convID = ''
  const policy = async () => {
    const res = await mainRead<{conversations?: Array<{convRetention?: Policy}> | null}>('chat.1.local.getInboxAndUnboxLocal', {
      identifyBehavior: 6,
      query: {computeActiveList: false, convIDs: [convIDBytes(convID)], readOnly: true, unreadOnly: false},
    })
    return res.conversations?.[0]?.convRetention ?? null
  }
  const infoPanel = (p: Page) => p.getByTestId(T.CHAT_INFO_PANEL)
  await withCleanup(async () => {
    convID = await makeSubteamChannel(name, channel)
    const original = await policy()
    expect(original?.typ ?? inherit, 'a new channel follows the team').toBe(inherit)
    await openChannelWithRetries(page, name, channel)
    await page.locator('.icon-gen-iconfont-info:visible').first().click()
    await infoPanel(page).getByTestId(T.CHAT_INFO_PANEL_SETTINGS_TAB).click()
    const dropdown = infoPanel(page).locator('.icon-gen-iconfont-caret-down:right-of(:text-is("Message deletion"))').first()
    await expect(infoPanel(page).getByText('Team default (Never)', {exact: true})).toBeVisible({timeout: 15_000})
    await pickRetention(page, dropdown, '30 days', true)
    await expect.poll(async () => (await policy())?.expire?.age, {message: 'the channel policy after 30 days', timeout: 30_000}).toBe(thirtyDays)
    await step(page, testInfo, 'channel 30 days')
    await pickRetention(page, dropdown, 'Never auto-delete', false)
    await expect.poll(async () => (await policy())?.typ, {message: 'the channel policy after Never', timeout: 30_000}).toBe(retain)
    await step(page, testInfo, 'channel never')
  }, [
    async () => {
      if (await infoPanel(page).isVisible()) await page.locator('.icon-gen-iconfont-info:visible').first().click()
    },
    async () => deleteSubteamIfPresent(name),
  ])
})

test('default channels', async ({page}, testInfo) => {
  test.setTimeout(240_000)
  const {name} = await makeSubteam('dch')
  const channel = stampedChannelName('dflt', e2eRunId())
  const defaults = async () => {
    const res = await mainRead<{convs?: Array<{channel: string}> | null}>('chat.1.local.getDefaultTeamChannelsLocal', {teamID: await teamID(name)})
    return (res.convs ?? []).map(c => c.channel)
  }
  await withCleanup(async () => {
    await makeSubteamChannel(name, channel)
    expect(await defaults(), 'a new channel is not a default one').not.toContain(channel)
    await openSettings(page, name)
    const add = settingsTab(page).getByPlaceholder('Add channels')
    await expect(add).toBeVisible({timeout: 15_000})
    await add.click()
    await add.fill(channel)
    await clickUnoccluded(page.getByText(`#${channel}`, {exact: true}).locator('visible=true').last())
    await expect.poll(defaults, {message: 'the default channels after adding one', timeout: 30_000}).toContain(channel)
    await step(page, testInfo, 'default channel added')
    const row = settingsTab(page).locator('div').filter({has: page.getByText(`#${channel}`, {exact: true})}).filter({has: page.locator('.icon-gen-iconfont-remove')}).last()
    await clickUnoccluded(row.locator('.icon-gen-iconfont-remove').last())
    await expect.poll(defaults, {message: 'the default channels after removing it', timeout: 30_000}).not.toContain(channel)
    await step(page, testInfo, 'default channel removed')
  }, [async () => deleteSubteamIfPresent(name)])
})
