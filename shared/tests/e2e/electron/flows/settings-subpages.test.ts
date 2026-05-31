import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {navigateToSettings} from '@/tests/e2e/electron/helpers/navigate'
import * as T from '@/tests/e2e/shared/test-ids'

// All nav clicks are scoped to the settings left-nav container (SETTINGS_ACCOUNT testID) to:
// - avoid matching main navigation tabs (Chat, Files) which share the same label text
// - ensure items below the fold (About) are scrolled into view within the nav container

test('Advanced page renders', async ({page}) => {
  await navigateToSettings(page)
  await page.getByTestId(T.SETTINGS_ACCOUNT).locator('text=Advanced').click()
  await expect(page.getByTestId(T.SETTINGS_ADVANCED)).toBeVisible({timeout: 5_000})
})

test('About page renders', async ({page}) => {
  await navigateToSettings(page)
  await page.getByTestId(T.SETTINGS_ACCOUNT).locator('text=About').click()
  await expect(page.getByTestId(T.SETTINGS_ABOUT)).toBeVisible({timeout: 5_000})
})

test('Backup page renders', async ({page}) => {
  await navigateToSettings(page)
  await page.getByTestId(T.SETTINGS_ACCOUNT).locator('text=Backup').click()
  await expect(page.getByTestId(T.SETTINGS_ARCHIVE)).toBeVisible({timeout: 5_000})
})

test('Chat page renders', async ({page}) => {
  await navigateToSettings(page)
  await page.getByTestId(T.SETTINGS_ACCOUNT).locator('text=Chat').click()
  await expect(page.getByTestId(T.SETTINGS_CHAT)).toBeVisible({timeout: 5_000})
})

test('Display page renders', async ({page}) => {
  await navigateToSettings(page)
  await page.getByTestId(T.SETTINGS_ACCOUNT).locator('text=Display').click()
  await expect(page.getByTestId(T.SETTINGS_DISPLAY)).toBeVisible({timeout: 5_000})
})

test('Feedback page renders', async ({page}) => {
  await navigateToSettings(page)
  await page.getByTestId(T.SETTINGS_ACCOUNT).locator('text=Feedback').click()
  await expect(page.getByTestId(T.SETTINGS_FEEDBACK)).toBeVisible({timeout: 5_000})
})

test('Files page renders', async ({page}) => {
  await navigateToSettings(page)
  await page.getByTestId(T.SETTINGS_ACCOUNT).locator('text=Files').click()
  await expect(page.getByTestId(T.SETTINGS_FILES)).toBeVisible({timeout: 5_000})
})

test('Notifications page renders', async ({page}) => {
  await navigateToSettings(page)
  await page.getByTestId(T.SETTINGS_ACCOUNT).locator('text=Notifications').click()
  await expect(page.getByTestId(T.SETTINGS_NOTIFICATIONS)).toBeVisible({timeout: 5_000})
})

test('Screen protector page renders', async ({page}) => {
  await navigateToSettings(page)
  await page.getByTestId(T.SETTINGS_ACCOUNT).locator('text=Screen protector').click()
  await expect(page.getByTestId(T.SETTINGS_SCREENPROTECTOR)).toBeVisible({timeout: 5_000})
})
