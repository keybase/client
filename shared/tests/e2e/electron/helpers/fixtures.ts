import {test as base, type Page, type WorkerInfo} from '@playwright/test'
import {connectToElectron} from './connect'
import {NAV_TAB_CHAT} from '@/tests/e2e/shared/test-ids'

type WorkerFixtures = {_electronPage: Page}

export const test = base.extend<{page: Page}, WorkerFixtures>({
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
})

export {expect} from '@playwright/test'
