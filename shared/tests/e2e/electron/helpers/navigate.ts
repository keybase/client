import type {Page} from '@playwright/test'
import * as T from '../../shared/test-ids'

export async function navigateToChat(page: Page): Promise<void> {
  await page.click('text=Chat')
  await page.waitForSelector(`[data-testid="${T.CHAT_INBOX_LIST}"]`, {timeout: 3_000})
}

export async function navigateToTeams(page: Page): Promise<void> {
  await page.click('text=Teams')
  await page.waitForSelector(`[data-testid="${T.TEAMS_LIST}"]`, {timeout: 3_000})
}

export async function navigateToFiles(page: Page): Promise<void> {
  await page.click('text=Files')
  await page.waitForSelector(`[data-testid="${T.FILES_BROWSER}"]`, {timeout: 3_000})
}

export async function navigateToDevices(page: Page): Promise<void> {
  await page.click('text=Devices')
  await page.waitForSelector(`[data-testid="${T.DEVICES_LIST}"]`, {timeout: 3_000})
}

export async function navigateToSettings(page: Page): Promise<void> {
  await page.click('text=Settings')
  await page.waitForSelector(`[data-testid="${T.SETTINGS_ACCOUNT}"]`, {timeout: 3_000})
}

export async function navigateToPeople(page: Page): Promise<void> {
  await page.click('text=People')
  await page.waitForSelector(`[data-testid="${T.PEOPLE_FEED}"]`, {timeout: 3_000})
}

export async function navigateToCrypto(page: Page): Promise<void> {
  await page.click('text=Crypto')
  await page.waitForSelector(`[data-testid="${T.CRYPTO_INPUT}"]`, {timeout: 3_000})
}

export async function navigateToGit(page: Page): Promise<void> {
  await page.click('text=Git')
  await page.waitForSelector(`[data-testid="${T.GIT_REPO_LIST}"]`, {timeout: 3_000})
}
