import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {navigateToCrypto} from '@/tests/e2e/electron/helpers/navigate'
import * as T from '@/tests/e2e/shared/test-ids'

test('encrypt input renders', async ({page}) => {
  await navigateToCrypto(page)
  await page.getByTestId(T.CRYPTO_NAV_ENCRYPT).first().click()
  await expect(page.getByTestId(T.CRYPTO_ENCRYPT_INPUT).first()).toBeVisible()
})

test('decrypt input renders', async ({page}) => {
  await navigateToCrypto(page)
  await page.getByTestId(T.CRYPTO_NAV_DECRYPT).first().click()
  await expect(page.getByTestId(T.CRYPTO_DECRYPT_INPUT).first()).toBeVisible()
})

test('sign input renders', async ({page}) => {
  await navigateToCrypto(page)
  await page.getByTestId(T.CRYPTO_NAV_SIGN).first().click()
  await expect(page.getByTestId(T.CRYPTO_SIGN_INPUT).first()).toBeVisible()
})

test('verify input renders', async ({page}) => {
  await navigateToCrypto(page)
  await page.getByTestId(T.CRYPTO_NAV_VERIFY).first().click()
  await expect(page.getByTestId(T.CRYPTO_VERIFY_INPUT).first()).toBeVisible()
})
