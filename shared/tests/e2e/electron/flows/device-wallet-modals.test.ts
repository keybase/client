import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {navigateToDevices, navigateToCrypto} from '@/tests/e2e/electron/helpers/navigate'
import {snap} from '@/tests/e2e/electron/helpers/snap'
import * as T from '@/tests/e2e/shared/test-ids'
import {closeModal} from '@/tests/e2e/electron/helpers/modal'

test('add device chooser opens', async ({page}, testInfo) => {
  await navigateToDevices(page)
  await page.getByText('Add a device or paper key', {exact: true}).click()
  const blurb = page.getByText('Protect your account by having more devices and paper keys.')
  await expect(blurb).toBeVisible({timeout: 5_000})
  await snap(page, testInfo)
  await closeModal(page)
  await expect(blurb).not.toBeVisible({timeout: 5_000})
})

// NOTE: no test touches the wallet Remove-account flow — stellar account
// removal is off-limits for automation (see the Forbidden list in
// plans/flow-test.md), even the open-and-cancel variant.

test('crypto recipients team builder opens', async ({page}, testInfo) => {
  await navigateToCrypto(page)
  await page.getByTestId(T.CRYPTO_NAV_ENCRYPT).click()
  // the "Search people" input itself is pointerEvents:none — click its wrapper
  await page.getByTestId(T.CRYPTO_RECIPIENTS).locator('visible=true').first().click()
  const search = page.getByPlaceholder('Search Keybase').locator('visible=true')
  await expect(search.first()).toBeVisible({timeout: 5_000})
  await snap(page, testInfo)
  await closeModal(page)
  await expect(search).toHaveCount(0, {timeout: 5_000})
})
