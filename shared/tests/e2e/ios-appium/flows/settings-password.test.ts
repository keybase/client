// The second account's password changed from the phone (Settings > Account > Change), through the
// rotation contract (accounts/second-password-lib.ts rotateSecondPassword): the new password is
// written to the env file as KB_SECOND_PASSWORD_NEXT first, set from the phone, checked (the second
// peer takes it, the phone keeps its stored secret and switches to the second account with no
// prompt, the host's main service still switches to it; gate/password.ts iosRotateDeps) and only
// then promoted to KB_SECOND_PASSWORD. The second account then signs out on the phone and signs back
// in with the new password. The smoke account's password is never read or set.
//
// Each password goes into a field only through submitSecret, with the secret-on-screen mark on while
// a field may hold it (no step, a failure's screenshot withheld); nothing here reads a page source;
// a retry would change the password again, so this file never retries. A change that stopped part
// way leaves KB_SECOND_PASSWORD_NEXT in the env file: then nothing more is typed, and the owner runs
// `yarn test:e2e:accounts:second-password --check`.
//
// The flow's afterEach empties any password field and clears the marks, signs the second account in
// with KB_SECOND_PASSWORD when the phone lost its stored secret (never while a change is pending),
// and puts the app back on the smoke account.
import {defaultEnvPath, loadE2EAccounts, loadE2EEnv, readEnvFile, requireSecondPassword} from '../../accounts/env'
import {CHECK_WORST_MS, rotateSecondPassword} from '../../accounts/second-password-lib'
import {withCleanup} from '../../shared/cleanup.ts'
import * as T from '../../shared/test-ids'
import {appAccount, asSecond, requireAppIsSmoke, restoreToSmoke} from '../gate/accounts'
import {randomPW} from '../gate/app-ask'
import {requireSecondNotBlocked} from '../gate/blocks'
import {iosRotateDeps, requireRotatable} from '../gate/password'
import {currentCallSeq, uiCallsSince, waitForUiCall} from '../gate/recorder'
import type {CallMark} from '../gate/recorder-lib'
import {emptySecretField, focusSecretField, submitSecret} from '../gate/secret-input'
import {clearSecretOnScreen, markSecretOnScreen} from '../gate/secret-screen.ts'
import {
  clearLoginPasswordMark,
  restoreSecondSecret,
  rowShows,
  storedSecretOf,
  waitPasswordScreenFor,
  waitStoredSecret,
  signInWithPassword,
  withLoginPasswordMarked,
} from '../gate/sign-in'
import {step} from '../gate/step'
import {byText, el, waitForTestID} from '../helpers/elements'
import {BUTTONS, expectScreen, tapButton} from '../helpers/files'
import {waitFor} from '../helpers/lifecycle'
import {check, labelledElement} from '../helpers/menus'
import {dismissKeyboard, escapeToTabs, navigateToMore, tapSettingsRow} from '../helpers/navigate'
import {masked} from '../helpers/teams'

const PASSPHRASE_CHANGE = 'keybase.1.account.passphraseChange'
const ACCOUNT_TAB = 'settingsTabs.accountTab'
const PASSWORD_FIELDS = [T.SETTINGS_NEW_PASSWORD_INPUT, T.SETTINGS_CONFIRM_PASSWORD_INPUT] as const
const NEW_PASSWORD_SHOWN = "the change password screen's fields"

// the iOS check (gate/password.ts), in s: the second peer's check 150, the stored secret 22, the
// switch to the second account and back 426 (the switch 150, the account 1, restoreToSmoke 275), the
// host's check
const CHECK_S = 150 + 22 + 426 + CHECK_WORST_MS / 1_000
// the phone's repair: restoreSecondSecret 410, the mark cleared 21, restoreToSmoke 275
const REPAIR_S = 706

describe('settings password', function () {
  // a retry would change the password again
  this.retries(0)

  // Each test's timeout is the sum of its helpers' bounds (s), so its own checks always fail first:
  //   second    asSecond 425 and its body (the switch 150, restoreToSmoke 275)
  //   page      openAccountPage 97 (escapeToTabs 30, the More tab 20, the row scrolled to 25 and tapped
  //             1, screen 11, the page 10);  ask  an askApp 22;  stored  storedSecretOf 22
  //   button    tapButton 7;  screen  a screen waited for 11, 21 with a 20s wait;  fields  11 each
  //   secret    focusSecretField 15 and submitSecret 20, each field;  emptying  35 a field
  //   save      the keyboard 1, Save enabled 6, seq 2, its tap 1, the call 12, its count 2, the screen
  //             gone 61, the mark cleared 2 = 87
  //   check     the iOS check CHECK_S;  repair  REPAIR_S;  checkOrRepair  2 CHECK_S + REPAIR_S
  //   sign out  the More tab 20, the row 26, its text 10, its tap 1, the login list 60, signed out 30,
  //             the secret dropped 52, the password screen 30, two row reads 20
  //   sign in   signInWithPassword 150, the secret stored 52, the mark cleared 21
  //   step      2 (its 1s settle and the attach)

  before(async function () {
    // a failed chat-blocks restore refuses here (the host read 75), and so does a pending change or a
    // server-synced key (the env file 1, the second peer 65)
    this.timeout(200_000)
    // the rotation writes the env file only, so a password from the environment would go stale
    check(
      !process.env['KB_SECOND_PASSWORD'] && !process.env['KB_SECOND_PASSWORD_NEXT'],
      'refusing to change the password: the second account password must come from the env file, which the rotation writes'
    )
    await masked(async () => requireSecondNotBlocked())
    await masked(async () => requireRotatable(loadE2EEnv()))
  })

  // -- what the afterEach puts back ---------------------------------------------------------------

  let fieldsMarked = false

  // Empties the change password screen's fields that are mounted. Bound: 35 a field.
  const emptyChangeFields = async () => {
    for (const id of PASSWORD_FIELDS) {
      if (!(await el(id).isExisting())) continue
      await focusSecretField(id)
      await emptySecretField(id)
    }
  }

  // Bound: 70.
  const clearChangeMark = async () => {
    if (!fieldsMarked) return
    await emptyChangeFields()
    fieldsMarked = false
    clearSecretOnScreen(NEW_PASSWORD_SHOWN)
  }

  // The second account's stored secret back on the phone when it is gone, signed in with
  // KB_SECOND_PASSWORD from the env file; nothing is typed while a change is pending (which of the
  // two passwords the server holds is the owner's to check). Bound: env 1, stored 22, sign in 431.
  const restoreSecret = async () => {
    if (readEnvFile(defaultEnvPath())['KB_SECOND_PASSWORD_NEXT']) return
    const password = requireSecondPassword(loadE2EEnv())
    if (await storedSecretOf(loadE2EAccounts().secondUser)) return
    await withLoginPasswordMarked(async () => restoreSecondSecret(password))
  }

  // Worst case (s): clearChangeMark 70, the login mark 21, restoreSecret 454, restoreToSmoke 275,
  // escapeToTabs 30 = 850 (it goes last: signed out, no tab bar is there to reach).
  afterEach(async function () {
    this.timeout(900_000)
    await withCleanup(clearChangeMark, [clearLoginPasswordMark, restoreSecret, restoreToSmoke, escapeToTabs])
  })

  // -- the phone ----------------------------------------------------------------------------------

  const countOf = async (seq: CallMark, method: string) => (await uiCallsSince(seq, method)).length

  // Settings > Account. Bound: 97.
  const openAccountPage = async () => {
    await escapeToTabs()
    await navigateToMore()
    await tapSettingsRow('Account')
    await expectScreen('the account page', ACCOUNT_TAB)
    await waitForTestID(T.SETTINGS_ACCOUNT_PAGE, 10_000)
  }

  // On the second account: Account > Change, `next` into both fields, Save; the screen closes once the
  // change went through. Bound: asSecond 425, the account 1, ask 22, page 97, button 7, screen 11,
  // fields 22, step 2, secret 70, save 87, screen 21, step 2 = 767.
  const changeOnPhone = async (next: string) =>
    asSecond(async () => {
      const {secondUser} = loadE2EAccounts()
      const a = await appAccount()
      check(a.loggedIn && a.username === secondUser, 'the app is not on the second account to change its password')
      check(!(await randomPW()), 'the second account has no password of its own; refusing')
      await openAccountPage()
      await tapButton('Change', "the account page's password Change")
      await expectScreen('the change password screen', 'settingsTabs.password')
      for (const id of PASSWORD_FIELDS) await el(id).waitForExist({timeout: 10_000})
      await step('The change password screen, its fields empty')

      // no step until the screen is gone (the afterEach empties the fields when it stops before)
      fieldsMarked = true
      markSecretOnScreen(NEW_PASSWORD_SHOWN)
      for (const id of PASSWORD_FIELDS) {
        await focusSecretField(id)
        await submitSecret(id, next)
      }
      await dismissKeyboard()
      const save = await waitFor(
        "the change password screen's Save enabled",
        async () => {
          const b = await labelledElement(BUTTONS, 'Save', "the change password screen's Save")
          return (await b.getAttribute('enabled')) === 'true' ? b : undefined
        },
        {interval: 250, timeout: 5_000}
      )
      const seq = await currentCallSeq()
      await save.click()
      await waitForUiCall('the password change to go out', seq, PASSPHRASE_CHANGE)
      check((await countOf(seq, PASSPHRASE_CHANGE)) === 1, 'Save sent the password change more than once')
      await waitFor(
        'the change password screen to close after the change',
        async () => ((await el(T.SETTINGS_NEW_PASSWORD_INPUT).isExisting()) ? undefined : true),
        {interval: 500, timeout: 60_000}
      )
      await clearChangeMark()
      await expectScreen('the account page after the change', ACCOUNT_TAB, () => true, 20_000)
      await step('The password changed', {card: true})
    })

  // On the second account: Settings > Sign out > "Just sign out" (which drops its stored secret), then
  // its password from the login screen, which stores it again. Bound: asSecond 425, the account 1,
  // sign out 249, step 2, sign in 223, step 2 = 902.
  const signOutAndBackIn = async (password: string) =>
    asSecond(async () => {
      const {secondUser, smokeUser} = loadE2EAccounts()
      check((await appAccount()).username === secondUser, 'the app is not on the second account to sign it out')
      await navigateToMore()
      await tapSettingsRow('Sign out')
      await byText('You will need it to sign back in.').waitForExist({timeout: 10_000, timeoutMsg: 'the sign-out screen never showed'})
      await byText('Just sign out').click()
      await el(T.LOGIN_USER_LIST).waitForExist({timeout: 60_000, timeoutMsg: 'the login screen never showed after signing out'})
      await waitFor('the app to sign out', async () => ((await appAccount()).loggedIn ? undefined : true), {interval: 500, timeout: 30_000})
      await waitStoredSecret(secondUser, false)
      await waitPasswordScreenFor(secondUser)
      check(await rowShows(T.LOGIN_USER_ROW_PREFIX + secondUser, 'Signed out'), "the login list does not show the second account signed out")
      check(await rowShows(T.LOGIN_USER_ROW_PREFIX + smokeUser, 'Signed in'), 'the login list does not show the smoke account signed in')
      await step('Signed out, the login screen asks for the second account password')

      // no step until the field is gone
      await withLoginPasswordMarked(async () => {
        await signInWithPassword(secondUser, password)
        await waitStoredSecret(secondUser, true)
      })
      await step('Signed in again with the new password')
    })

  it('the second account password changed from the phone, then signed in with', async function () {
    // worst case (s): stored 22, the env file 1, change 767, checkOrRepair 2 CHECK_S + REPAIR_S, the
    // promotion 1, the env file 1, step 2, signOutAndBackIn 902, stored 22, smoke 1, step 2; and 60
    // to spare
    this.timeout((22 + 1 + 767 + 2 * CHECK_S + REPAIR_S + 1 + 1 + 2 + 902 + 22 + 1 + 2 + 60) * 1_000)
    const env = loadE2EEnv()
    // refuses while a change that stopped part way is unresolved
    requireSecondPassword(env)
    const {secondUser} = loadE2EAccounts()
    check(await storedSecretOf(secondUser), 'the phone keeps no stored secret for the second account before the change')

    const next = await rotateSecondPassword(env, changeOnPhone, iosRotateDeps())
    const file = readEnvFile(defaultEnvPath())
    check(file['KB_SECOND_PASSWORD'] === next && !file['KB_SECOND_PASSWORD_NEXT'], 'the env file does not hold the new password as KB_SECOND_PASSWORD')
    await step('The change checked and the new password promoted in the env file')

    await signOutAndBackIn(next)
    check(await storedSecretOf(secondUser), 'the phone keeps no stored secret for the second account after signing in with the new password')
    await requireAppIsSmoke()
    await step('Back on the smoke account, the second account signed in')
  })
})
