import {chromium, type Browser, type Page} from '@playwright/test'

const CDP_ENDPOINT = 'http://localhost:9222'

async function getLoggedInUser(page: Page): Promise<string> {
  const text = await page.locator('.username').first().innerText()
  // "Hi chrisnojima!" → "chrisnojima"
  return text.replace(/^Hi /, '').replace(/!$/, '').trim()
}

export async function connectToElectron(): Promise<{browser: Browser; page: Page}> {
  const smokeUser = process.env['KB_SMOKE_USER']
  if (!smokeUser) {
    throw new Error('KB_SMOKE_USER is not set — set it to the expected logged-in username to run e2e tests')
  }

  const browser = await chromium.connectOverCDP(CDP_ENDPOINT, {timeout: 3_000})

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

  await mainPage.waitForSelector('text=Chat', {timeout: 3_000})

  const loggedInUser = await getLoggedInUser(mainPage)
  if (loggedInUser !== smokeUser) {
    throw new Error(`Expected to be logged in as "${smokeUser}" but found "${loggedInUser}"`)
  }

  return {browser, page: mainPage}
}

export async function disconnect(): Promise<void> {
  // Do NOT call browser.close() — that kills the Electron process
}
