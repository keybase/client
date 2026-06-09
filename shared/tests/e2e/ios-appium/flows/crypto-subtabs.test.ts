import {expect} from '@wdio/globals'
import {escapeToTabs, navigateToMore} from '../helpers/navigate'
import {el, waitForTestID, byText} from '../helpers/elements'
import * as T from '../../shared/test-ids'

describe('crypto subtabs', () => {
  it('all four crypto subtabs render their input', async () => {
    await escapeToTabs()
    await navigateToMore()
    // Maestro: tapOn text: ".*Crypto" — label match for the Crypto menu item
    await byText('Crypto').click()
    await waitForTestID(T.CRYPTO_INPUT, 3000)

    // Encrypt
    await el(T.CRYPTO_NAV_ENCRYPT).click()
    await waitForTestID(T.CRYPTO_ENCRYPT_INPUT, 3000)
    await expect(el(T.CRYPTO_ENCRYPT_INPUT)).toExist()
    await el(T.COMMON_BACK_BUTTON).click()

    // Decrypt
    await el(T.CRYPTO_NAV_DECRYPT).click()
    await waitForTestID(T.CRYPTO_DECRYPT_INPUT, 3000)
    await expect(el(T.CRYPTO_DECRYPT_INPUT)).toExist()
    await el(T.COMMON_BACK_BUTTON).click()

    // Sign
    await el(T.CRYPTO_NAV_SIGN).click()
    await waitForTestID(T.CRYPTO_SIGN_INPUT, 3000)
    await expect(el(T.CRYPTO_SIGN_INPUT)).toExist()
    await el(T.COMMON_BACK_BUTTON).click()

    // Verify
    await el(T.CRYPTO_NAV_VERIFY).click()
    await waitForTestID(T.CRYPTO_VERIFY_INPUT, 3000)
    await expect(el(T.CRYPTO_VERIFY_INPUT)).toExist()
    await el(T.COMMON_BACK_BUTTON).click()
  })
})
