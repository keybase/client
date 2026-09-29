import {chromium, type Browser, type Page} from '@playwright/test'
import {NAV_TAB_CHAT} from '@/tests/e2e/shared/test-ids'

const CDP_ENDPOINT = 'http://localhost:9222'
const connectTimeoutMs = 5_000
const readyTimeoutMs = 15_000
const appLog = process.env['KB_E2E_APP_LOG'] ?? '/tmp/chat-e2e-electron.log'

// What to say when the app is not there or not ready, so a stuck app fails fast and says where to look.
export const appNotReady = (what: string, afterMs: number) =>
  new Error(
    `app not ready after ${afterMs / 1000}s (${what}) — see ${appLog}; relaunch with node tests/e2e/electron/launch-app.mts`
  )

async function getLoggedInUser(page: Page): Promise<string> {
  const text = await page.locator('.username').first().innerText({timeout: 5_000})
  // "Hi exampleuser!" → "exampleuser"
  return text.replace(/^Hi /, '').replace(/!$/, '').trim()
}

export async function connectToElectron(): Promise<{browser: Browser; page: Page}> {
  const smokeUser = process.env['KB_SMOKE_USER']
  if (!smokeUser) {
    throw new Error('KB_SMOKE_USER is not set — set it to the expected logged-in username to run e2e tests')
  }

  let browser: Browser
  try {
    browser = await chromium.connectOverCDP(CDP_ENDPOINT, {timeout: connectTimeoutMs})
  } catch {
    throw appNotReady(`no CDP answer at ${CDP_ENDPOINT}`, connectTimeoutMs)
  }

  // KB_E2E_TEST=1 suppresses the menubar widget and devtools windows, so
  // pages()[0] is always the main app. Keep the URL check as a safety net.
  const allPages = browser.contexts().flatMap(ctx => ctx.pages())
  const mainPage = allPages.find(p => p.url().includes('main.html')) ?? allPages[0]

  if (!mainPage) {
    throw new Error('Could not find main app page. Is the app running with KB_ENABLE_REMOTE_DEBUG=1 KB_E2E_TEST=1?')
  }

  try {
    await mainPage.getByTestId(NAV_TAB_CHAT).waitFor({timeout: readyTimeoutMs})
  } catch {
    throw appNotReady('the chat tab is not showing in main.html', readyTimeoutMs)
  }

  const loggedInUser = await getLoggedInUser(mainPage)
  if (loggedInUser !== smokeUser) {
    throw new Error(`Expected to be logged in as "${smokeUser}" but found "${loggedInUser}"`)
  }

  return {browser, page: mainPage}
}

export async function disconnect(): Promise<void> {
  // Do NOT call browser.close() — that kills the Electron process
}
