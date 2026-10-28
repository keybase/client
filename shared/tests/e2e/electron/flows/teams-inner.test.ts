import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {openE2ETeam} from '@/tests/e2e/electron/helpers/navigate'
import * as T from '@/tests/e2e/shared/test-ids'

// Unique tab labels in the team tabs bar (capitalize(title) from Kb.Tabs)
// 'Settings' and 'Emoji' appear in the nav sidebar too, so we use .nth(1) for those.
// 'Members', 'Bots', 'Channels', 'Subteams' are unique to the team tabs bar.

test('members tab renders', async ({page}) => {
  await openE2ETeam(page)
  // the team page remembers the last tab per team for the life of the app, so an
  // earlier test can leave it on Channels/Settings — select Members explicitly
  await page.getByTestId(T.TEAMS_TAB_MEMBERS_BUTTON).locator('visible=true').first().click()
  await expect(page.getByTestId(T.TEAMS_MEMBER_LIST).first()).toBeVisible({timeout: 5_000})
})

test('settings tab renders', async ({page}) => {
  await openE2ETeam(page)
  await page.getByTestId(T.TEAMS_TAB_SETTINGS_BUTTON).locator('visible=true').first().click()
  // assert the settings BODY, not the 'Members' tab label: that label is part of
  // the tab bar and is visible on every tab, so it passes without switching
  await expect(page.getByTestId(T.TEAMS_SETTINGS_TAB).first()).toBeVisible({timeout: 5_000})
})

test('bots tab renders', async ({page}) => {
  await openE2ETeam(page)
  await page.getByText('Bots', {exact: true}).first().click()
  await expect(page.getByTestId(T.TEAMS_BOTS_TAB).first()).toBeVisible({timeout: 5_000})
})

test('channels tab renders', async ({page}) => {
  await openE2ETeam(page)
  // the e2e team is a big team (its e2e-* channels), so it has a Channels tab
  const channelsTab = page.getByTestId(T.TEAMS_TAB_CHANNELS_BUTTON).locator('visible=true').first()
  await expect(channelsTab, 'the e2e team Channels tab').toBeVisible({timeout: 5_000})
  await channelsTab.click()
  await expect(page.getByTestId(T.TEAMS_CHANNEL_LIST).first()).toBeVisible({timeout: 5_000})
})
