import type {Page} from '@playwright/test'
import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {navigateToCrypto} from '@/tests/e2e/electron/helpers/navigate'
import * as T from '@/tests/e2e/shared/test-ids'

// The crypto encrypt tab has two textboxes (recipients "Search people" + main input).
// Use .last() so the recipients search box (which comes first) is skipped.
// Scope CRYPTO_OUTPUT to the tab container since TabRouter keeps all tabs mounted.
async function fillCryptoInput(page: Page, containerTestID: string, text: string) {
  await page.getByTestId(containerTestID).getByRole('textbox').last().fill(text)
}

async function expectCryptoOutput(page: Page, containerTestID: string) {
  await expect(
    page.getByTestId(containerTestID).getByTestId(T.CRYPTO_OUTPUT)
  ).toBeVisible({timeout: 10_000})
}

test('Encrypt → output renders', async ({page}) => {
  await navigateToCrypto(page)
  await page.getByTestId(T.CRYPTO_NAV_ENCRYPT).click()
  await expect(page.getByTestId(T.CRYPTO_ENCRYPT_INPUT).first()).toBeVisible()
  await fillCryptoInput(page, T.CRYPTO_ENCRYPT_INPUT, 'hello e2e')
  await expectCryptoOutput(page, T.CRYPTO_ENCRYPT_INPUT)
})

test('Sign → output renders', async ({page}) => {
  await navigateToCrypto(page)
  await page.getByTestId(T.CRYPTO_NAV_SIGN).click()
  await expect(page.getByTestId(T.CRYPTO_SIGN_INPUT).first()).toBeVisible()
  await fillCryptoInput(page, T.CRYPTO_SIGN_INPUT, 'hello e2e')
  await expectCryptoOutput(page, T.CRYPTO_SIGN_INPUT)
})

test('Decrypt → output renders', async ({page}) => {
  await navigateToCrypto(page)
  // Encrypt first to get valid ciphertext
  await page.getByTestId(T.CRYPTO_NAV_ENCRYPT).click()
  await expect(page.getByTestId(T.CRYPTO_ENCRYPT_INPUT).first()).toBeVisible()
  await fillCryptoInput(page, T.CRYPTO_ENCRYPT_INPUT, 'hello e2e')
  await expectCryptoOutput(page, T.CRYPTO_ENCRYPT_INPUT)
  const ciphertext = await page.getByTestId(T.CRYPTO_ENCRYPT_INPUT).getByTestId(T.CRYPTO_OUTPUT).innerText()
  // Decrypt it
  await page.getByTestId(T.CRYPTO_NAV_DECRYPT).click()
  await expect(page.getByTestId(T.CRYPTO_DECRYPT_INPUT).first()).toBeVisible()
  await fillCryptoInput(page, T.CRYPTO_DECRYPT_INPUT, ciphertext)
  await expectCryptoOutput(page, T.CRYPTO_DECRYPT_INPUT)
})

test('Verify → output renders', async ({page}) => {
  await navigateToCrypto(page)
  // Sign first to get a valid signed message
  await page.getByTestId(T.CRYPTO_NAV_SIGN).click()
  await expect(page.getByTestId(T.CRYPTO_SIGN_INPUT).first()).toBeVisible()
  await fillCryptoInput(page, T.CRYPTO_SIGN_INPUT, 'hello e2e')
  await expectCryptoOutput(page, T.CRYPTO_SIGN_INPUT)
  const signedText = await page.getByTestId(T.CRYPTO_SIGN_INPUT).getByTestId(T.CRYPTO_OUTPUT).innerText()
  // Verify it
  await page.getByTestId(T.CRYPTO_NAV_VERIFY).click()
  await expect(page.getByTestId(T.CRYPTO_VERIFY_INPUT).first()).toBeVisible()
  await fillCryptoInput(page, T.CRYPTO_VERIFY_INPUT, signedText)
  await expectCryptoOutput(page, T.CRYPTO_VERIFY_INPUT)
})
