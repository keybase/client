import {test as base, type ConsoleMessage, type Page, type WorkerInfo} from '@playwright/test'
import {checkRendererAfterReload, connectToElectron} from './connect'
import {loadE2EAccounts} from '@/tests/e2e/accounts/env'
import {ensureChatData} from '@/tests/e2e/shared/chat-data'
import {requireMainIsSmoke} from '@/tests/e2e/shared/peer-service'
import {runIdFromEnv} from '@/tests/e2e/accounts/run-id'

type WorkerFixtures = {_electronPage: Page}
type TestFixtures = {_mainIsSmoke: undefined; _rendererErrors: undefined; page: Page}

// Uncaught renderer errors that are known noise, not app failures. Each entry says why; keep the
// list short and the patterns narrow. A match is still attached to the results, just not failed.
const benignPageErrors: ReadonlyArray<{pattern: RegExp; why: string}> = []

const isBenign = (message: string) => benignPageErrors.some(b => b.pattern.test(message))

// Chromium's own console error for each Content Security Policy or Trusted Types violation
const cspViolation = /violates the following Content Security Policy directive|requires 'Trusted(?:HTML|Script|ScriptURL)' assignment/

export const test = base.extend<TestFixtures, WorkerFixtures>({
  // Before every test body, not just once per worker: a flow that switched the main service and
  // failed to switch it back fails the next test, naming the account, instead of driving the app
  // as that account.
  _mainIsSmoke: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, setup) => {
      await requireMainIsSmoke(loadE2EAccounts())
      await setup(undefined)
    },
    {auto: true},
  ],

  _electronPage: [
    // Playwright requires object destructuring syntax here — it uses static analysis to
    // detect fixture dependencies, so a plain identifier like `_fixtures` breaks injection.
    // eslint-disable-next-line no-empty-pattern
    async ({}, setup, workerInfo: WorkerInfo) => {
      // every worker, before it touches the app: the app acts as whoever the main service is signed in as
      await requireMainIsSmoke(loadE2EAccounts())
      const isDark = workerInfo.project.name.endsWith('-dark')
      const {page} = await connectToElectron()
      // emulateMedia sets prefers-color-scheme via CDP and persists across reloads
      await page.emulateMedia({colorScheme: isDark ? 'dark' : 'light'})
      // Reload to clear in-memory state and apply the new color scheme; a renderer that comes back
      // white fails here at once with the app log's tail
      await checkRendererAfterReload(page)
      try {
        await setup(page)
      } finally {
        await page.emulateMedia({colorScheme: null})
      }
      // Do NOT close — that kills the Electron process
    },
    // connect (up to 20s) plus a reload and the chat tab coming back (up to 20s each)
    {scope: 'worker', timeout: 70_000},
  ],

  page: async ({_electronPage}, setup) => {
    await setup(_electronPage)
  },

  // Listens from before the test body runs to after it ends: renderer console errors are attached
  // to the results, and a Content Security Policy violation or any uncaught page error not listed as
  // benign fails the test.
  _rendererErrors: [
    async ({page}, setup, testInfo) => {
      const consoleErrors: Array<string> = []
      const pageErrors: Array<string> = []
      const onConsole = (m: ConsoleMessage) => {
        if (m.type() === 'error') consoleErrors.push(m.text())
      }
      const onPageError = (e: Error) => {
        pageErrors.push(`${e.name}: ${e.message}\n${e.stack ?? ''}`)
      }
      page.on('console', onConsole)
      page.on('pageerror', onPageError)
      // resolves once the test body is done, whether it passed or not
      await setup(undefined)
      page.off('console', onConsole)
      page.off('pageerror', onPageError)
      if (consoleErrors.length) {
        await testInfo.attach('renderer-console-errors', {
          body: consoleErrors.join('\n\n'),
          contentType: 'text/plain',
        })
      }
      if (pageErrors.length) {
        await testInfo.attach('renderer-page-errors', {body: pageErrors.join('\n\n'), contentType: 'text/plain'})
      }
      const failing = [
        ...consoleErrors.filter(e => cspViolation.test(e)),
        ...pageErrors.filter(e => !isBenign(e.replace(/^\w+: /, ''))),
      ]
      if (failing.length) {
        throw new Error(`CSP violation(s) or uncaught renderer error(s) during the test:\n${failing.join('\n\n')}`)
      }
    },
    {auto: true},
  ],
})

export {expect} from '@playwright/test'

// ensureChatData for a beforeAll: hooks run before any test's account check, so this checks first.
export const seedChatData = async () => {
  await requireMainIsSmoke(loadE2EAccounts())
  return ensureChatData()
}

// This run's id (global-setup.ts sets it), which the names a flow creates carry so the sweeper can
// clear what a crashed run leaves.
export const e2eRunId = () => {
  const id = runIdFromEnv(process.env)
  if (!id) throw new Error('KB_E2E_RUN_ID is not set: global-setup.ts sets it before any test')
  return id
}
