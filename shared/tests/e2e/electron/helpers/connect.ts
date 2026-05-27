import {chromium, type Browser, type Page} from '@playwright/test'

const CDP_ENDPOINT = 'http://localhost:9222'

async function getLoggedInUser(page: Page): Promise<string> {
  const text = await page.locator('.username').first().innerText()
  // "Hi exampleuser!" → "exampleuser"
  return text.replace(/^Hi /, '').replace(/!$/, '').trim()
}

export async function connectToElectron(): Promise<{browser: Browser; page: Page}> {
  const smokeUser = process.env['KB_SMOKE_USER']
  if (!smokeUser) {
    throw new Error('KB_SMOKE_USER is not set — set it to the expected logged-in username to run e2e tests')
  }

  const browser = await chromium.connectOverCDP(CDP_ENDPOINT, {timeout: 3_000})

  // KB_E2E_TEST=1 suppresses the menubar widget and devtools windows, so
  // pages()[0] is always the main app. Keep the URL check as a safety net.
  const allPages = browser.contexts().flatMap(ctx => ctx.pages())
  const mainPage = allPages.find(p => p.url().includes('main.dev.html')) ?? allPages[0]

  if (!mainPage) {
    throw new Error('Could not find main app page. Is the app running with KB_ENABLE_REMOTE_DEBUG=1 KB_E2E_TEST=1?')
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
