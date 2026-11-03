// The second account's password changed from the phone (Settings > Account > Change), through the
// rotation contract (accounts/second-password-lib.ts rotateSecondPassword): the new password is
// written to the env file as KB_SECOND_PASSWORD_NEXT first, set from the phone, checked (the second
// peer takes it, the phone keeps its stored secret and switches to the second account with no
// prompt; gate/password.ts iosRotateDeps) and only then promoted to KB_SECOND_PASSWORD. The host's
// main service is never switched: right after the change its login switch deadlocks in a logout hook,
// so the test stops at the manual edge second-password-host-check once everything else passed, and
// the owner runs the --check after the release. The second account then signs out on the phone and
// signs back in with the new password. The smoke account's password is never read or set.
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
import {defaultEnvPath, loadE2EAccounts, loadE2EEnv, readEnvFile} from '../../accounts/env'
import {rotateSecondPassword, sayMasked, settlePendingSecondPassword} from '../../accounts/second-password-lib'
import {withCleanup} from '../../shared/cleanup.ts'
import * as T from '../../shared/test-ids'
import {appAccount, asSecond, requireAppIsSmoke, restoreToSmoke} from '../gate/accounts'
import {isAttemptOver} from '../gate/attempt-binding-lib'
import {randomPW} from '../gate/app-ask'
import {requireSecondNotBlocked} from '../gate/blocks'
import {iosRotateDeps, requirePhoneSecondPassword, requireRotatable} from '../gate/password'
import {currentCallSeq, uiCallCount, waitForUiCall} from '../gate/recorder'
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
import {manualEdge, step} from '../gate/step'
import {byText, el} from '../helpers/elements'
import {buttonLabelled, clickUntil, tapButton} from '../helpers/files'
import {expectScreen} from '../gate/screens'
import {waitFor} from '../helpers/lifecycle'
import {check} from '../helpers/menus'
import {dismissKeyboard, escapeToTabs, navigateToMore, tapSettingsRow} from '../helpers/navigate'
import {ACCOUNT_TAB, openAccountPage} from '../helpers/settings'
import {masked} from '../helpers/teams'

const PASSPHRASE_CHANGE = 'keybase.1.account.passphraseChange'
const PASSWORD_FIELDS = [T.SETTINGS_NEW_PASSWORD_INPUT, T.SETTINGS_CONFIRM_PASSWORD_INPUT] as const
const NEW_PASSWORD_SHOWN = "the change password screen's fields"

// the iOS check (gate/password.ts), in s: the second peer's check 150, the stored secret 22, the
// switch to the second account and back 426 (the switch 150, the account 1, restoreToSmoke 275)
const CHECK_S = 150 + 22 + 426
// the phone's repair: restoreSecondSecret 410, the mark cleared 21, restoreToSmoke 275
const REPAIR_S = 706

describe('settings password', function () {
  // a retry would change the password again
  this.retries(0)

  // Each test's timeout is the sum of its helpers' bounds (s), so its own checks always fail first:
  //   second    asSecond 425 and its body (the switch 150, restoreToSmoke 275)
  //   page      openAccountPage 126 (escapeToTabs 30, the More tab 20, the row scrolled to 54 and tapped
  //             1, screen 11, the page 10);  ask  an askApp 22;  stored  storedSecretOf 22
  //   button    tapButton 7;  screen  a screen waited for 11, 21 with a 20s wait;  fields  11 each
  //   secret    focusSecretField 15 and submitSecret 20, each field;  emptying  35 a field
  //   save      the keyboard 1, Save enabled 6, seq 2, clickUntil 10, the call 12, its count 2, the
  //             screen gone 61, the mark cleared 2 = 96
  //   check     the iOS check CHECK_S;  repair  REPAIR_S;  checkOrRepair  2 CHECK_S + REPAIR_S
  //   sign out  the More tab 20, the row 55, its text 10, its tap 1, the login list 60, signed out 30,
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

  // the call log's mark taken before the test's change, so the afterEach can tell whether the phone
  // sent one
  let attemptMark: CallMark | undefined

  // Whether the phone's call log proves it sent no password change since attemptMark. A log that
  // cannot be read (a new JS runtime, a stopped recorder, no mark) proves nothing. Bound: a read 2.
  const provedNoChangeSent = async () => {
    const mark = attemptMark
    if (!mark) return false
    try {
      return (await uiCallCount(mark, PASSPHRASE_CHANGE)) === 0
    } catch (e) {
      if (isAttemptOver(e)) throw e
      return false
    }
  }

  // A KB_SECOND_PASSWORD_NEXT a change left pending, settled on the second peer: it checks both
  // passwords (no prompt, nothing changes). It is promoted when the server holds it. It is dropped
  // only when the phone sent no change in this attempt: a change still on its way (Save sent it, the
  // screen never closed) reads as not taken yet, so then it stays and the owner's --check settles it
  // later. Neither or both throws for the owner. Bound: the env file 1, two peer checks 2 x 105, the
  // call log 2 = 213.
  const settlePending = async () => {
    let settled: Awaited<ReturnType<typeof settlePendingSecondPassword>>
    try {
      settled = await masked(async () => settlePendingSecondPassword(loadE2EEnv(), defaultEnvPath(), undefined, provedNoChangeSent))
    } finally {
      attemptMark = undefined
    }
    if (settled !== 'none') sayMasked(`settings-password: a pending KB_SECOND_PASSWORD_NEXT was ${settled}`)
  }

  // The second account's stored secret back on the phone when it is gone, signed in with
  // KB_SECOND_PASSWORD from the env file. While a change is pending nothing is typed (which of the
  // two passwords the server holds is the owner's to check): this throws the owner action with the
  // phone's note. Bound: env 1, stored 22, sign in 431.
  const restoreSecret = async () => {
    const password = requirePhoneSecondPassword(loadE2EEnv())
    if (await storedSecretOf(loadE2EAccounts().secondUser)) return
    await withLoginPasswordMarked(async () => restoreSecondSecret(password))
  }

  // Worst case (s): clearChangeMark 70, the login mark 21, settlePending 213, restoreSecret 454,
  // restoreToSmoke 275, escapeToTabs 30 = 1063 (it goes last: signed out, no tab bar is there to
  // reach).
  afterEach(async function () {
    this.timeout(1_100_000)
    await withCleanup(clearChangeMark, [clearLoginPasswordMark, settlePending, restoreSecret, restoreToSmoke, escapeToTabs])
  })

  // -- the phone ----------------------------------------------------------------------------------

  // On the second account: Account > Change, `next` into both fields, Save; the screen closes once the
  // change went through. Bound: asSecond 425, the account 1, ask 22, page 126, button 7, screen 11,
  // fields 22, step 2, secret 70, save 96, screen 21, step 2 = 805.
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
          const b = await buttonLabelled('Save', "the change password screen's Save")
          return (await b.getAttribute('enabled')) === 'true' ? b : undefined
        },
        {interval: 250, timeout: 5_000}
      )
      const seq = await currentCallSeq()
      // a click with the keyboard still up only closes it: a second click goes only when the first
      // sent nothing, so the change is never sent twice
      await clickUntil(async () => Promise.resolve(save), async () => (await uiCallCount(seq, PASSPHRASE_CHANGE)) > 0, "the change password screen's Save")
      await waitForUiCall('the password change to go out', seq, PASSPHRASE_CHANGE)
      check((await uiCallCount(seq, PASSPHRASE_CHANGE)) === 1, 'Save sent the password change more than once')
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
  // sign out 278, step 2, sign in 223, step 2 = 931.
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
    // worst case (s): stored 22, the env file 1, seq 2, change 805, checkOrRepair 2 CHECK_S + REPAIR_S, the
    // promotion 1, the env file 1, step 2, signOutAndBackIn 931, stored 22, smoke 1, step 2, manual 2;
    // and 60 to spare
    this.timeout((22 + 1 + 2 + 805 + 2 * CHECK_S + REPAIR_S + 1 + 1 + 2 + 931 + 22 + 1 + 2 + 2 + 60) * 1_000)
    const env = loadE2EEnv()
    // refuses while a change that stopped part way is unresolved
    requirePhoneSecondPassword(env)
    const {secondUser} = loadE2EAccounts()
    check(await storedSecretOf(secondUser), 'the phone keeps no stored secret for the second account before the change')

    // before the rotation writes KB_SECOND_PASSWORD_NEXT
    attemptMark = await currentCallSeq()
    const next = await rotateSecondPassword(env, changeOnPhone, iosRotateDeps())
    const file = readEnvFile(defaultEnvPath())
    check(file['KB_SECOND_PASSWORD'] === next && !file['KB_SECOND_PASSWORD_NEXT'], 'the env file does not hold the new password as KB_SECOND_PASSWORD')
    await step('The change checked and the new password promoted in the env file')

    await signOutAndBackIn(next)
    check(await storedSecretOf(secondUser), 'the phone keeps no stored secret for the second account after signing in with the new password')
    await requireAppIsSmoke()
    await step('Back on the smoke account, the second account signed in')

    // the host's stored secret for the second account is the owner's to check (gate/password.ts)
    await manualEdge('second-password-host-check')
  })
})
