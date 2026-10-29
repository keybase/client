import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {navigateToDevices, navigateToCrypto} from '@/tests/e2e/electron/helpers/navigate'
import {step} from '@/tests/e2e/electron/helpers/step'
import * as T from '@/tests/e2e/shared/test-ids'
import {closeModal} from '@/tests/e2e/electron/helpers/modal'

test('add device chooser opens', async ({page}, testInfo) => {
  await navigateToDevices(page)
  await page.getByText('Add a device or paper key', {exact: true}).click()
  const blurb = page.getByText('Protect your account by having more devices and paper keys.')
  await expect(blurb).toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'add device chooser')
  await closeModal(page)
  await expect(blurb).not.toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'chooser closed')
})

// NOTE: no test touches the wallet Remove-account flow — stellar account
// removal is off-limits for automation (see the Forbidden list in
// plans/flow-test.md), even the open-and-cancel variant.

test('crypto recipients team builder opens', async ({page}, testInfo) => {
  await navigateToCrypto(page)
  await page.getByTestId(T.CRYPTO_NAV_ENCRYPT).click()
  await step(page, testInfo, 'encrypt tab')
  // the "Search people" input itself is pointerEvents:none — click its wrapper
  await page.getByTestId(T.CRYPTO_RECIPIENTS).locator('visible=true').first().click()
  const search = page.getByPlaceholder('Search Keybase').locator('visible=true')
  await expect(search.first()).toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'crypto recipients team builder', {card: true})
  await closeModal(page)
  await expect(search).toHaveCount(0, {timeout: 5_000})
  await step(page, testInfo, 'team builder closed')
})
