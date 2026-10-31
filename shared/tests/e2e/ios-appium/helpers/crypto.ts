// Helpers for the iOS crypto flows: the crypto sub-nav, reached from the More tab's Crypto row (the
// phone's only way in: it is the settingsTabs.cryptoTab screen, never desktop's cryptoRoot tab), an
// operation's input screen opened from its row and left by its back, and the output modal closed by
// its header's Done.
import * as T from '../../shared/test-ids'
import {el, tapForTestID, waitForTestID} from './elements'
import {expectScreen} from './files'
import {check} from './menus'
import {escapeToTabs, goBackUntilGone, navigateToMore, tapSettingsRow} from './navigate'
import {tapHeaderAction} from './teams'

export const CRYPTO_SUB_NAV = 'settingsTabs.cryptoTab'

export type CryptoTab = 'decrypt' | 'encrypt' | 'sign' | 'verify'

// Each operation's sub-nav row, its input screen's marker and route, and its output modal's route.
export const CRYPTO_TABS = {
  decrypt: {input: T.CRYPTO_DECRYPT_INPUT, nav: T.CRYPTO_NAV_DECRYPT, output: 'decryptOutput', route: 'decryptTab'},
  encrypt: {input: T.CRYPTO_ENCRYPT_INPUT, nav: T.CRYPTO_NAV_ENCRYPT, output: 'encryptOutput', route: 'encryptTab'},
  sign: {input: T.CRYPTO_SIGN_INPUT, nav: T.CRYPTO_NAV_SIGN, output: 'signOutput', route: 'signTab'},
  verify: {input: T.CRYPTO_VERIFY_INPUT, nav: T.CRYPTO_NAV_VERIFY, output: 'verifyOutput', route: 'verifyTab'},
} as const

// The crypto sub-nav, from wherever the app is. Bound: escapeToTabs 30, the More tab 15, the row 25,
// the screen 11, the sub-nav 5 = 86.
export const openCrypto = async () => {
  await escapeToTabs()
  await navigateToMore()
  await tapSettingsRow('Crypto')
  await expectScreen('the crypto sub-nav', CRYPTO_SUB_NAV)
  await waitForTestID(T.CRYPTO_INPUT, 5_000)
}

// The operation's input screen, from the sub-nav. Bound: tapForTestID 18 (three taps 1 and 5s
// waits), the screen 11 = 29.
export const openCryptoTab = async (tab: CryptoTab) => {
  const {input, nav, route} = CRYPTO_TABS[tab]
  await tapForTestID(nav, input)
  await expectScreen(`the ${tab} screen`, route)
}

// Back from the operation's input screen to the sub-nav, with its field gone. Bound: goBackUntilGone
// 12 (three backs 1 and 3s waits), the screen 11, the field 1 = 24.
export const leaveCryptoTab = async (tab: CryptoTab) => {
  await goBackUntilGone(CRYPTO_TABS[tab].input)
  await expectScreen(`the crypto sub-nav after the ${tab} screen`, CRYPTO_SUB_NAV)
  check(!(await el(T.CRYPTO_TEXT_INPUT).isExisting()), `the ${tab} screen's field is still drawn`)
}

// Closes the output modal by its header's Done, back to the operation's input screen. Bound:
// tapHeaderAction 6, the screen 11, the output gone 5 = 22.
export const closeCryptoOutput = async (tab: CryptoTab) => {
  await tapHeaderAction('Done', "the output's Done")
  await expectScreen(`the ${tab} screen after Done`, CRYPTO_TABS[tab].route)
  await el(T.CRYPTO_OUTPUT).waitForExist({reverse: true, timeout: 5_000})
}
