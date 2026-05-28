import {test as base, type Page} from '@playwright/test'
import {connectToElectron} from './connect'

type WorkerFixtures = {_electronPage: Page}

export const test = base.extend<{page: Page}, WorkerFixtures>({
  _electronPage: [
    // Playwright requires object destructuring syntax here — it uses static analysis to
    // detect fixture dependencies, so a plain identifier like `_fixtures` breaks injection.
    // eslint-disable-next-line no-empty-pattern
    async ({}, setup) => {
      const {page} = await connectToElectron()
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
