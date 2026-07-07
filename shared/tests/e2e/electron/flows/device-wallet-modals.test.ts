import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {navigateToDevices, navigateToCrypto} from '@/tests/e2e/electron/helpers/navigate'
import {snap} from '@/tests/e2e/electron/helpers/snap'
import * as T from '@/tests/e2e/shared/test-ids'

test('add device chooser opens', async ({page}, testInfo) => {
  await navigateToDevices(page)
  await page.getByText('Add a device or paper key', {exact: true}).click()
  const blurb = page.getByText('Protect your account by having more devices and paper keys.')
  await expect(blurb).toBeVisible({timeout: 5_000})
  await snap(page, testInfo)
  await page.locator('.icon-gen-iconfont-close:visible').first().click()
  await expect(blurb).not.toBeVisible({timeout: 5_000})
})

// NOTE: no test touches the wallet Remove-account flow — stellar account
// removal is off-limits for automation (see the Forbidden list in
// plans/flow-test.md), even the open-and-cancel variant.

test('crypto recipients team builder opens', async ({page}, testInfo) => {
  await navigateToCrypto(page)
  await page.getByTestId(T.CRYPTO_NAV_ENCRYPT).click()
  await page.getByPlaceholder('Search people').locator('visible=true').first().click()
  const search = page.getByPlaceholder('Search Keybase').locator('visible=true')
  await expect(search.first()).toBeVisible({timeout: 5_000})
  await snap(page, testInfo)
  await page.locator('.icon-gen-iconfont-close:visible').first().click()
  await expect(search).toHaveCount(0, {timeout: 5_000})
})
