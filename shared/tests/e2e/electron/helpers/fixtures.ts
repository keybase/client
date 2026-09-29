import {test as base, type ConsoleMessage, type Page, type WorkerInfo} from '@playwright/test'
import {connectToElectron} from './connect'
import {NAV_TAB_CHAT} from '@/tests/e2e/shared/test-ids'

type WorkerFixtures = {_electronPage: Page}
type TestFixtures = {_rendererErrors: undefined; page: Page}

// Uncaught renderer errors that are known noise, not app failures. Each entry says why; keep the
// list short and the patterns narrow. A match is still attached to the results, just not failed.
const benignPageErrors: ReadonlyArray<{pattern: RegExp; why: string}> = []

const isBenign = (message: string) => benignPageErrors.some(b => b.pattern.test(message))

export const test = base.extend<TestFixtures, WorkerFixtures>({
  _electronPage: [
    // Playwright requires object destructuring syntax here — it uses static analysis to
    // detect fixture dependencies, so a plain identifier like `_fixtures` breaks injection.
    // eslint-disable-next-line no-empty-pattern
    async ({}, setup, workerInfo: WorkerInfo) => {
      const isDark = workerInfo.project.name.endsWith('-dark')
      const {page} = await connectToElectron()
      // emulateMedia sets prefers-color-scheme via CDP and persists across reloads
      await page.emulateMedia({colorScheme: isDark ? 'dark' : 'light'})
      // Reload to clear in-memory state and apply the new color scheme
      await page.reload()
      await page.getByTestId(NAV_TAB_CHAT).waitFor({timeout: 30_000})
      try {
        await setup(page)
      } finally {
        await page.emulateMedia({colorScheme: null})
      }
      // Do NOT close — that kills the Electron process
    },
    {scope: 'worker'},
  ],

  page: async ({_electronPage}, setup) => {
    await setup(_electronPage)
  },

  // Listens from before the test body runs to after it ends: renderer console errors are attached
  // to the results, and any uncaught page error not listed as benign fails the test.
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
      const failing = pageErrors.filter(e => !isBenign(e.replace(/^\w+: /, '')))
      if (failing.length) {
        throw new Error(`uncaught renderer error(s) during the test:\n${failing.join('\n\n')}`)
      }
    },
    {auto: true},
  ],
})

export {expect} from '@playwright/test'
