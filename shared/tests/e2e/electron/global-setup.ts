// Before any test runs: the dev app's renderer must be healthy after a reload. A renderer that loads
// white (its main module failing to fetch, as when the dev server served a tree changing under it)
// aborts the whole run here in seconds, with the app log's tail, instead of every test failing on it.
import {chromium} from '@playwright/test'
import {checkRendererAfterReload, findMainPage} from './helpers/connect'

export default async function globalSetup() {
  const browser = await chromium.connectOverCDP('http://localhost:9222', {timeout: 5_000}).catch(() => {
    throw new Error('the dev app is not answering on CDP (relaunch with node tests/e2e/electron/launch-app.mts)')
  })
  const page = findMainPage(browser)
  // Proof hook: KB_E2E_BLOCK_MODULE=<url substring> fails that request during the reload, which is
  // what a half-written tree does to the renderer.
  const block = process.env['KB_E2E_BLOCK_MODULE']
  if (block) await page.route(url => url.href.includes(block), async route => route.abort())
  try {
    await checkRendererAfterReload(page)
  } finally {
    if (block) await page.unrouteAll({behavior: 'ignoreErrors'})
  }
  // never close the browser: that quits Electron
}
