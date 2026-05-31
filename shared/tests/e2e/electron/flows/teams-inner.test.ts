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
  // Members is the default tab; verify member-list content loaded
  await expect(page.getByText('Already in team', {exact: false}).first()).toBeVisible({timeout: 5_000})
})

test('settings tab renders', async ({page}) => {
  const opened = await openFirstTeam(page)
  if (!opened) {
    test.skip()
    return
  }
  // 'Settings' appears in both nav sidebar and team tabs — use .nth(1) for team tab
  await page.getByText('Settings', {exact: true}).nth(1).click()
  // Verify we're still in the team view (Members tab still visible)
  await expect(page.getByText('Members', {exact: true}).first()).toBeVisible({timeout: 5_000})
})

test('bots tab renders', async ({page}) => {
  const opened = await openFirstTeam(page)
  if (!opened) {
    test.skip()
    return
  }
  await page.getByText('Bots', {exact: true}).first().click()
  await expect(page.getByText('Members', {exact: true}).first()).toBeVisible({timeout: 5_000})
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
  await expect(page.getByText('Members', {exact: true}).first()).toBeVisible({timeout: 5_000})
})
