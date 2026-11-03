// The phone's crypto screens, read-only: the sub-nav the More tab's Crypto row opens (the
// settingsTabs.cryptoTab screen; the phone has no crypto tab, so desktop's cryptoRoot is never what
// it shows) and each operation's input screen opened from its row and left by its back, one
// operation per test. Nothing is typed or run (crypto-roundtrip does that).
import {step} from '../gate/step'
import {CRYPTO_TABS, type CryptoTab, leaveCryptoTab, openCrypto, openCryptoTab} from '../helpers/crypto'
import {el} from '../helpers/elements'
import {check} from '../helpers/menus'

describe('crypto', function () {
  // Each test's bound (s): openCrypto 115, step 2, openCryptoTab 29, the field 10, step 2,
  // leaveCryptoTab 24, step 2 = 184.
  const tour = async (tab: CryptoTab, title: string) => {
    await openCrypto()
    check(await el(CRYPTO_TABS[tab].nav).isExisting(), `the sub-nav has no ${tab} row`)
    await step('The crypto sub-nav')
    await openCryptoTab(tab)
    // the field is inside its box's one element: the box is the screen's field
    await el(CRYPTO_TABS[tab].input).waitForExist({timeout: 10_000})
    await step(`The ${title} screen`, {card: true})
    await leaveCryptoTab(tab)
    await step('Back on the crypto sub-nav')
  }

  it('the encrypt screen from the crypto sub-nav', async function () {
    // worst case (s): the tour 184
    this.timeout(190_000)
    await tour('encrypt', 'Encrypt')
  })

  it('the decrypt screen from the crypto sub-nav', async function () {
    // worst case (s): the tour 184
    this.timeout(190_000)
    await tour('decrypt', 'Decrypt')
  })

  it('the sign screen from the crypto sub-nav', async function () {
    // worst case (s): the tour 184
    this.timeout(190_000)
    await tour('sign', 'Sign')
  })

  it('the verify screen from the crypto sub-nav', async function () {
    // worst case (s): the tour 184
    this.timeout(190_000)
    await tour('verify', 'Verify')
  })
})
