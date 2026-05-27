import {test as base, type Page, type TestInfo} from '@playwright/test'
import {connectToElectron} from './connect'

type WorkerFixtures = {_electronPage: Page}

export const test = base.extend<{page: Page}, WorkerFixtures>({
  _electronPage: [
    async ({}, use) => {
      const {page} = await connectToElectron()
      await use(page)
      // Do NOT close — that kills the Electron process
    },
    {scope: 'worker'},
  ],

  page: async ({_electronPage}, use, testInfo: TestInfo) => {
    await use(_electronPage)
    // Take screenshot from the known main-app page — auto-screenshot grabs all
    // CDP windows (including the menubar widget) and picks the wrong one.
    const screenshot = await _electronPage.screenshot()
    await testInfo.attach('screenshot', {body: screenshot, contentType: 'image/png'})
  },
})

export {expect} from '@playwright/test'
