import {expect} from '@wdio/globals'
import {escapeToTabs, navigateToMore} from '../helpers/navigate'
import {el, waitForTestID, byText} from '../helpers/elements'
import * as T from '../../shared/test-ids'

// Two separate tests: the crypto output is shown in its own modal whose "Done"
// dismiss doesn't cleanly return to the input tabs, so each operation navigates
// fresh rather than chaining. (beforeTest reset is cheap within one session.)
describe('crypto outputs', () => {
  it('encrypt produces output', async () => {
    await escapeToTabs()
    await navigateToMore()
    await byText('Crypto').click()
    await waitForTestID(T.CRYPTO_INPUT, 3000)

    await el(T.CRYPTO_NAV_ENCRYPT).click()
    await waitForTestID(T.CRYPTO_ENCRYPT_INPUT, 3000)
    await el(T.CRYPTO_ENCRYPT_INPUT).click()
    await el(T.CRYPTO_ENCRYPT_INPUT).setValue('hello e2e')
    await el(T.CRYPTO_RUN_BUTTON).click()
    await waitForTestID(T.CRYPTO_OUTPUT, 10000)
    await expect(el(T.CRYPTO_OUTPUT)).toExist()
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
  })
})
