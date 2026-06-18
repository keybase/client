import {expect} from '@wdio/globals'
import {escapeToTabs, navigateToMore, goBackUntilGone} from '../helpers/navigate'
import {el, waitForTestID, byText, tapForTestID} from '../helpers/elements'
import * as T from '../../shared/test-ids'

describe('crypto subtabs', () => {
  it('all four crypto subtabs render their input', async () => {
    await escapeToTabs()
    await navigateToMore()
    // Maestro: tapOn text: ".*Crypto" — label match for the Crypto menu item
    await byText('Crypto').click()
    await waitForTestID(T.CRYPTO_INPUT, 3000)

    // Each sub-nav tap immediately follows a push/pop transition; on slow sims
    // the first tap is swallowed mid-transition. tapForTestID retries the tap;
    // goBackUntilGone retries the back until the popped input vanishes (pop
    // settled) before the next tab tap.
    // Encrypt
    await tapForTestID(T.CRYPTO_NAV_ENCRYPT, T.CRYPTO_ENCRYPT_INPUT)
    await expect(el(T.CRYPTO_ENCRYPT_INPUT)).toExist()
    await goBackUntilGone(T.CRYPTO_ENCRYPT_INPUT)

    // Decrypt
    await tapForTestID(T.CRYPTO_NAV_DECRYPT, T.CRYPTO_DECRYPT_INPUT)
    await expect(el(T.CRYPTO_DECRYPT_INPUT)).toExist()
    await goBackUntilGone(T.CRYPTO_DECRYPT_INPUT)

    // Sign
    await tapForTestID(T.CRYPTO_NAV_SIGN, T.CRYPTO_SIGN_INPUT)
    await expect(el(T.CRYPTO_SIGN_INPUT)).toExist()
    await goBackUntilGone(T.CRYPTO_SIGN_INPUT)

    // Verify
    await tapForTestID(T.CRYPTO_NAV_VERIFY, T.CRYPTO_VERIFY_INPUT)
    await expect(el(T.CRYPTO_VERIFY_INPUT)).toExist()
  })
})
