import {expect} from '@wdio/globals'
import {escapeToTabs, navigateToMore} from '../helpers/navigate'
import {el, waitForTestID, byText} from '../helpers/elements'
import * as T from '../../shared/test-ids'

describe('crypto outputs', () => {
  it('encrypt produces output', async () => {
    await escapeToTabs()
    await navigateToMore()
    // Maestro: scrollUntilVisible + tapOn text: ".*Crypto" — label match for the Crypto menu item
    await byText('Crypto').click()
    await waitForTestID(T.CRYPTO_INPUT, 3000)

    await el(T.CRYPTO_NAV_ENCRYPT).click()
    await waitForTestID(T.CRYPTO_ENCRYPT_INPUT, 3000)
    await el(T.CRYPTO_ENCRYPT_INPUT).click()
    await el(T.CRYPTO_ENCRYPT_INPUT).setValue('hello e2e')
    await el(T.CRYPTO_RUN_BUTTON).click()
    await waitForTestID(T.CRYPTO_OUTPUT, 10000)
    await expect(el(T.CRYPTO_OUTPUT)).toExist()

    // Maestro: tapOn text: "Done" then backButton
    await byText('Done').click()
    await el(T.COMMON_BACK_BUTTON).click()
  })

  it('sign produces output', async () => {
    await escapeToTabs()
    await navigateToMore()
    await byText('Crypto').click()
    await waitForTestID(T.CRYPTO_INPUT, 3000)

    await el(T.CRYPTO_NAV_SIGN).click()
    await waitForTestID(T.CRYPTO_SIGN_INPUT, 3000)
    await el(T.CRYPTO_SIGN_INPUT).click()
    await el(T.CRYPTO_SIGN_INPUT).setValue('hello e2e')
    await el(T.CRYPTO_RUN_BUTTON).click()
    await waitForTestID(T.CRYPTO_OUTPUT, 10000)
    await expect(el(T.CRYPTO_OUTPUT)).toExist()

    await byText('Done').click()
    await el(T.COMMON_BACK_BUTTON).click()
  })
})
