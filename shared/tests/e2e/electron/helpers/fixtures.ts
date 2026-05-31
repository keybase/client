import {test as base, type Page} from '@playwright/test'
import {connectToElectron} from './connect'
import {NAV_TAB_CHAT} from '@/tests/e2e/shared/test-ids'

type WorkerFixtures = {_electronPage: Page}

export const test = base.extend<{page: Page}, WorkerFixtures>({
  _electronPage: [
    // Playwright requires object destructuring syntax here — it uses static analysis to
    // detect fixture dependencies, so a plain identifier like `_fixtures` breaks injection.
    // eslint-disable-next-line no-empty-pattern
    async ({}, setup) => {
      const {page} = await connectToElectron()
      // Reload to clear any in-memory state left over from previous test runs
      await page.reload()
      await page.getByTestId(NAV_TAB_CHAT).waitFor({timeout: 30_000})
      await setup(page)
      // Do NOT close — that kills the Electron process
    },
    {scope: 'worker'},
  ],

  page: async ({_electronPage}, setup) => {
    await setup(_electronPage)
  },
})

export {expect} from '@playwright/test'
