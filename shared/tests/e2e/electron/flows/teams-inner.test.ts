import type {Page} from '@playwright/test'
import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {navigateToTeams} from '@/tests/e2e/electron/helpers/navigate'
import * as T from '@/tests/e2e/shared/test-ids'

async function openFirstTeam(page: Page): Promise<boolean> {
  await navigateToTeams(page)
  const rows = page.getByTestId(T.TEAMS_ROW)
  if ((await rows.count()) === 0) return false
  await rows.first().click()
  // Wait for team list rows to disappear — indicates we've entered the team detail
  await rows.first().waitFor({state: 'hidden', timeout: 5_000})
  return true
}

// Unique tab labels in the team tabs bar (capitalize(title) from Kb.Tabs)
// 'Settings' and 'Emoji' appear in the nav sidebar too, so we use .nth(1) for those.
// 'Members', 'Bots', 'Channels', 'Subteams' are unique to the team tabs bar.

test('members tab renders', async ({page}) => {
  const opened = await openFirstTeam(page)
  if (!opened) {
    test.skip()
    return
  }
  // the team page remembers the last tab per team for the life of the app, so an
  // earlier test can leave it on Channels/Settings — select Members explicitly
  await page.getByTestId(T.TEAMS_TAB_MEMBERS_BUTTON).locator('visible=true').first().click()
  await expect(page.getByTestId(T.TEAMS_MEMBER_LIST).first()).toBeVisible({timeout: 5_000})
})

test('settings tab renders', async ({page}) => {
  const opened = await openFirstTeam(page)
  if (!opened) {
    test.skip()
    return
  }
  await page.getByTestId(T.TEAMS_TAB_SETTINGS_BUTTON).locator('visible=true').first().click()
  // assert the settings BODY, not the 'Members' tab label: that label is part of
  // the tab bar and is visible on every tab, so it passes without switching
  await expect(page.getByTestId(T.TEAMS_SETTINGS_TAB).first()).toBeVisible({timeout: 5_000})
})

test('bots tab renders', async ({page}) => {
  const opened = await openFirstTeam(page)
  if (!opened) {
    test.skip()
    return
  }
  await page.getByText('Bots', {exact: true}).first().click()
  await expect(page.getByTestId(T.TEAMS_BOTS_TAB).first()).toBeVisible({timeout: 5_000})
})

test('channels tab renders (if big team or admin)', async ({page}) => {
  const opened = await openFirstTeam(page)
  if (!opened) {
    test.skip()
    return
  }
  const channelsTab = page.getByText('Channels', {exact: true}).first()
  if (!(await channelsTab.isVisible())) {
    test.skip()
    return
  }
  await channelsTab.click()
  await expect(page.getByTestId(T.TEAMS_CHANNEL_LIST).first()).toBeVisible({timeout: 5_000})
})
