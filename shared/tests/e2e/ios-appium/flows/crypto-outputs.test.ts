import {expect} from '@wdio/globals'
import {escapeToTabs, navigateToMore, tapSettingsRow} from '../helpers/navigate'
import {el, waitForTestID, tapForTestID, enterText} from '../helpers/elements'
import * as T from '../../shared/test-ids'

// Two separate tests: the crypto output is shown in its own modal whose "Done"
// dismiss doesn't cleanly return to the input tabs, so each operation navigates
// fresh rather than chaining. (beforeTest reset is cheap within one session.)
describe('crypto outputs', () => {
  it('encrypt produces output', async () => {
    await escapeToTabs()
    await navigateToMore()
    await tapSettingsRow('Crypto')
    await waitForTestID(T.CRYPTO_INPUT, 3000)

    await tapForTestID(T.CRYPTO_NAV_ENCRYPT, T.CRYPTO_ENCRYPT_INPUT)
    await enterText(T.CRYPTO_ENCRYPT_INPUT, 'hello e2e')
    await el(T.CRYPTO_RUN_BUTTON).click()
    await waitForTestID(T.CRYPTO_OUTPUT, 10000)
    await expect(el(T.CRYPTO_OUTPUT)).toExist()
  })

  it('sign produces output', async () => {
    await escapeToTabs()
    await navigateToMore()
    await tapSettingsRow('Crypto')
    await waitForTestID(T.CRYPTO_INPUT, 3000)

    await tapForTestID(T.CRYPTO_NAV_SIGN, T.CRYPTO_SIGN_INPUT)
    await enterText(T.CRYPTO_SIGN_INPUT, 'hello e2e')
    await el(T.CRYPTO_RUN_BUTTON).click()
    await waitForTestID(T.CRYPTO_OUTPUT, 10000)
    await expect(el(T.CRYPTO_OUTPUT)).toExist()
  })
})
