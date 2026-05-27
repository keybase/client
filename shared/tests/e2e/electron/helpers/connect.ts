import {chromium, type Browser, type Page} from '@playwright/test'

const CDP_ENDPOINT = 'http://localhost:9222'

export async function connectToElectron(): Promise<{browser: Browser; page: Page}> {
  const browser = await chromium.connectOverCDP(CDP_ENDPOINT, {timeout: 10_000})
  const page = browser.contexts()[0]!.pages()[0]!
  await page.waitForSelector('text=Chat', {timeout: 10_000})
  return {browser, page}
}

export async function disconnect(): Promise<void> {
  // Do NOT call browser.close() — that kills the Electron process
}
