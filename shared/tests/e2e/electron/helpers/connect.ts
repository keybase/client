import {chromium, type Browser, type Page} from '@playwright/test'

const CDP_ENDPOINT = 'http://localhost:9222'

export async function connectToElectron(): Promise<{browser: Browser; page: Page}> {
  const browser = await chromium.connectOverCDP(CDP_ENDPOINT, {timeout: 10_000})

  // Find the main app by URL — tab order varies (DevTools, menubar, main app can be in any index)
  let mainPage: Page | undefined
  for (const ctx of browser.contexts()) {
    for (const p of ctx.pages()) {
      if (p.url().includes('main.dev.html')) {
        mainPage = p
        break
      }
    }
    if (mainPage) break
  }

  if (!mainPage) {
    throw new Error('Could not find main app page (main.dev.html). Is the app running with KB_ENABLE_REMOTE_DEBUG=1?')
  }

  await mainPage.waitForSelector('text=Chat', {timeout: 10_000})
  return {browser, page: mainPage}
}

export async function disconnect(): Promise<void> {
  // Do NOT call browser.close() — that kills the Electron process
}
