import * as fs from 'fs'
import {chromium, type Browser, type CDPSession, type ConsoleMessage, type Page} from '@playwright/test'
import {NAV_TAB_CHAT} from '../../shared/test-ids.ts'
import {appLogPath} from '../app-log.ts'

const CDP_ENDPOINT = 'http://localhost:9222'
const connectTimeoutMs = 5_000
const readyTimeoutMs = 15_000
const appLog = appLogPath()

// What to say when the app is not there or not ready, so a stuck app fails fast and says where to look.
export const appNotReady = (what: string, afterMs: number) =>
  new Error(
    `app not ready after ${afterMs / 1000}s (${what}) — see ${appLog}; relaunch with node tests/e2e/electron/launch-app.mts`
  )

const appLogTail = (lines: number) => {
  try {
    return fs.readFileSync(appLog, 'utf8').split('\n').slice(-lines).join('\n')
  } catch {
    return `(no log at ${appLog})`
  }
}

export const findMainPage = (browser: Browser) => {
  const allPages = browser.contexts().flatMap(ctx => ctx.pages())
  const page = allPages.find(p => p.url().includes('main.html')) ?? allPages[0]
  if (!page) throw new Error('Could not find main app page. Is the app running with KB_ENABLE_REMOTE_DEBUG=1 KB_E2E_TEST=1?')
  return page
}

// What a renderer that will stay white says as it loads: its main module (or a module it imports)
// failing to fetch or evaluate.
const loadFailure = /load failed|Failed to fetch dynamically imported module|error loading dynamically imported module/i

// Reloads the renderer and waits for the chat tab, failing in seconds, with the app log's tail, the
// moment the load reports a module failure or an uncaught error, rather than waiting out the
// deadline on a page that will never show anything.
export async function checkRendererAfterReload(page: Page, deadlineMs = 20_000) {
  let failure: string | undefined
  // Everything the reload said that could explain a failure, reported only if it fails: a module
  // the browser refuses before any request (a policy or MIME check) leaves no failed request behind,
  // only its own log entry.
  const said: Array<string> = []
  const onConsole = (m: ConsoleMessage) => {
    if (m.type() !== 'error') return
    said.push(`console: ${m.text()}`)
    if (loadFailure.test(m.text())) failure ??= `console: ${m.text()}`
  }
  const onPageError = (e: Error) => {
    failure ??= `uncaught: ${e.message}`
  }
  // A module failing to load names only the module that imported it (the entry, for a dynamic
  // import), so the failed module requests themselves are kept to say which one it was and why.
  const moduleFailures: Array<string> = []
  const isModule = (url: string) => /\.(tsx?|mjs|js)(\?|$)/.test(url) || url.includes('/node_modules/.vite/')
  const onRequestFailed = (r: {failure: () => {errorText: string} | null; url: () => string}) => {
    // the old document's requests the reload cancels fail as aborted; those say nothing
    const why = r.failure()?.errorText ?? ''
    if (isModule(r.url()) && !why.includes('ERR_ABORTED')) {
      moduleFailures.push(`${r.url()} (${why})`)
      failure ??= `module request failed: ${r.url()} (${why})`
    }
  }
  // The dev server answers some module requests with an error status rather than failing them, as
  // Vite does with a 504 for a prebundled dependency it has re-optimized since the page asked. Only
  // kept to explain a failure: a module the app imports optionally may answer one harmlessly.
  const onResponse = (r: {status: () => number; statusText: () => string; url: () => string}) => {
    if (r.status() >= 400 && isModule(r.url())) moduleFailures.push(`${r.url()} (${r.status()} ${r.statusText()})`)
  }
  page.on('console', onConsole)
  page.on('pageerror', onPageError)
  page.on('requestfailed', onRequestFailed)
  page.on('response', onResponse)
  let cdp: CDPSession | undefined
  try {
    cdp = await page.context().newCDPSession(page)
    cdp.on('Log.entryAdded', ({entry}) => {
      if (entry.level === 'error' || entry.level === 'warning') said.push(`chromium ${entry.source} ${entry.level}: ${entry.text} ${entry.url ?? ''}`)
    })
    cdp.on('Network.loadingFailed', e => {
      if (e.errorText !== 'net::ERR_ABORTED' || e.blockedReason) said.push(`network: ${e.errorText} ${e.blockedReason ?? ''} (${e.requestId})`)
    })
    await cdp.send('Log.enable')
    await cdp.send('Network.enable')
    await page.reload({timeout: deadlineMs, waitUntil: 'commit'})
    const start = Date.now()
    for (;;) {
      if (failure) break
      if (await page.getByTestId(NAV_TAB_CHAT).isVisible().catch(() => false)) return
      if (Date.now() - start > deadlineMs) {
        failure = `the chat tab did not show within ${deadlineMs / 1000}s of the reload`
        break
      }
      await page.waitForTimeout(100)
    }
  } finally {
    page.off('console', onConsole)
    page.off('pageerror', onPageError)
    page.off('requestfailed', onRequestFailed)
    page.off('response', onResponse)
    await cdp?.detach().catch(() => {})
  }
  const failedModules = moduleFailures.length ? `\n--- failed module requests ---\n${moduleFailures.join('\n')}` : ''
  const reloadSaid = said.length ? `\n--- what the reload logged ---\n${said.join('\n')}` : ''
  throw new Error(
    `the renderer is not healthy after a reload: ${failure}${failedModules}${reloadSaid}\n--- last 40 lines of ${appLog} ---\n${appLogTail(40)}\n` +
      'relaunch with node tests/e2e/electron/launch-app.mts'
  )
}

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
