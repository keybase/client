import type {Page} from '@playwright/test'
import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {
  navigateToSettings,
  navigateToPeople,
  navigateToFiles,
  navigateToTeams,
  navigateToChat,
  openFirstConversation,
  openOwnProfile,
} from '@/tests/e2e/electron/helpers/navigate'
import {snap} from '@/tests/e2e/electron/helpers/snap'
import * as T from '@/tests/e2e/shared/test-ids'

// Scroll a container by hovering it and spinning the wheel; a large delta lands
// at the end of the list, which is a deterministic position.
async function wheel(page: Page, selector: string, deltaY: number) {
  await page.locator(selector).first().hover()
  await page.mouse.wheel(0, deltaY)
  // let the virtualized list settle
  await page.waitForTimeout(500)
}

test('settings advanced scrolled to bottom', async ({page}, testInfo) => {
  await navigateToSettings(page)
  await page.getByTestId(T.SETTINGS_ACCOUNT).locator('text=Advanced').click()
  await expect(page.getByTestId(T.SETTINGS_ADVANCED)).toBeVisible({timeout: 5_000})
  await wheel(page, `[data-testid="${T.SETTINGS_ADVANCED}"]`, 5_000)
  await snap(page, testInfo)
})

test('settings notifications scrolled to bottom', async ({page}, testInfo) => {
  await navigateToSettings(page)
  await page.getByTestId(T.SETTINGS_ACCOUNT).locator('text=Notifications').click()
  await expect(page.getByTestId(T.SETTINGS_NOTIFICATIONS)).toBeVisible({timeout: 5_000})
  await wheel(page, `[data-testid="${T.SETTINGS_NOTIFICATIONS}"]`, 10_000)
  await snap(page, testInfo)
})

test('chat inbox scrolled to bottom', async ({page}, testInfo) => {
  await navigateToChat(page)
  await wheel(page, `[data-testid="${T.CHAT_INBOX_LIST}"]`, 20_000)
  await snap(page, testInfo)
})

test('chat conversation scrolled up', async ({page}, testInfo) => {
  if (!(await openFirstConversation(page))) {
    test.skip()
    return
  }
  await wheel(page, `[data-testid="${T.CHAT_MESSAGE_LIST}"]`, -5_000)
  await snap(page, testInfo)
})

test('files tlf list scrolled to bottom', async ({page}, testInfo) => {
  await navigateToFiles(page)
  await wheel(page, `[data-testid="${T.FILES_BROWSER}"]`, 20_000)
  await snap(page, testInfo)
})

test('people feed scrolled down', async ({page}, testInfo) => {
  await navigateToPeople(page)
  await wheel(page, `[data-testid="${T.PEOPLE_FEED}"]`, 10_000)
  await snap(page, testInfo)
})

test('team members scrolled to bottom', async ({page}, testInfo) => {
  await navigateToTeams(page)
  const rows = page.getByTestId(T.TEAMS_ROW)
  if ((await rows.count()) === 0) {
    test.skip()
    return
  }
  await rows.first().click()
  await expect(page.getByTestId(T.TEAMS_MEMBER_LIST).first()).toBeVisible({timeout: 5_000})
  await wheel(page, `[data-testid="${T.TEAMS_MEMBER_LIST}"]`, 10_000)
  await snap(page, testInfo)
})

test('own profile scrolled down', async ({page}, testInfo) => {
  await openOwnProfile(page)
  await wheel(page, `[data-testid="${T.PROFILE_PAGE}"]`, 5_000)
  await snap(page, testInfo)
  await navigateToPeople(page)
})
