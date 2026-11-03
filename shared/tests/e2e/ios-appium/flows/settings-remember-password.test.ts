// Settings > Advanced > "Always stay logged in" on the phone, as the second account: switched off from
// the phone and read back from the phone's own service (the setting lives there, per account); a
// relaunch then finds the second account signed out with its stored secret gone (the smoke account's
// kept), which is what the setting does, so the second account signs in again with its password from
// the login screen; switched on again, read back, and after another relaunch the app signs the second
// account in by itself.
//
// The password is KB_SECOND_PASSWORD from the env file, checked current on the second peer before
// anything changes (only it puts the stored secret back). It goes into the login field only through
// submitSecret, with the secret-on-screen mark on while the field may hold it (no step, a failure's
// screenshot withheld); a retry would type it again, so this file never retries. The setting is read
// and set only while the app is on the second account: the service answers for the account signed in.
//
// Before the test, a setting an earlier run's failed restore left off is put back on (and a lost stored
// secret signed in again), from the second account, so the test starts from on.
//
// The flow's afterEach empties the login field and clears the mark, signs the second account in with
// its password when the phone lost its stored secret, puts the setting back on (from the second
// account), checks the secret is stored, and puts the app back on the smoke account.
import {loadE2EAccounts, loadE2EEnv} from '../../accounts/env'
import {secondPasswordIsCurrent} from '../../accounts/second-password-lib'
import {withCleanup} from '../../shared/cleanup.ts'
import * as T from '../../shared/test-ids'
import {appAccount, restoreToSmoke, settledAppAccount, signInFromStoredSecret} from '../gate/accounts'
import {rememberPassphrase, setRememberPassphrase} from '../gate/app-ask'
import {creditSurface} from '../gate/attempt'
import {requireSecondNotBlocked} from '../gate/blocks'
import {relaunchApp} from '../gate/device'
import {requirePhoneSecondPassword} from '../gate/password'
import {repairRememberLeftOff} from '../gate/remember-lib.ts'
import {expectScreen, pressBackToLoginList} from '../gate/screens'
import {currentCallSeq, uiCallCount, waitForUiCall} from '../gate/recorder'
import {clearLoginPasswordMark, restoreSecondSecret, storedSecretOf, withLoginPasswordMarked} from '../gate/sign-in'
import {step} from '../gate/step'
import {switchAppAccount, waitSignedIn} from '../helpers/chat'
import {el} from '../helpers/elements'
import {waitFor} from '../helpers/lifecycle'
import {check} from '../helpers/menus'
import {escapeToTabs, navigateToMore, tapSettingsRow} from '../helpers/navigate'
import {masked} from '../helpers/teams'

const SET_REMEMBER = 'keybase.1.config.setRememberPassphrase'

describe('settings remember password', function () {
  // a retry would type the password again
  this.retries(0)

  // Each test's timeout is the sum of its helpers' bounds (s), so its own checks always fail first:
  //   peer      the password check on the second peer 150 (its service start 30, two whoamis 30, the
  //             check 60, connecting 30)
  //   ask       an askApp 22 (20, the pause and resume 2);  stored  storedSecretOf 22
  //   switch    switchAppAccount 150 (the switcher 60, the switch 60, escapeToTabs 30);  account  1;
  //             settled  60
  //   advanced  openAdvanced 126 (escapeToTabs 30, the More tab 20, the row scrolled to 54 and tapped
  //             1, screen 11, the switch 10)
  //   tap       tapRemember 59 (seq 2, the tap 1, the call 12, its count 2, 20s of asks overrun by one
  //             22)
  //   relaunch  relaunchApp 200;  signed in  90
  //   sign in   restoreSecondSecret 410 (secret read 22, settling 60, to the login list 100, the row
  //             30, the sign-in 150, the secret stored 50), the mark cleared 21 (the field 1, emptying
  //             20)
  //   restore   restoreToSmoke 275 (settling 60, a sign-in from the login list 215)
  //   step      2 (its 1s settle and the attach)

  const onSecond = async () => {
    const a = await appAccount()
    return a.loggedIn && !a.switching && a.username === loadE2EAccounts().secondUser
  }

  // The setting on for the second account with its stored secret in place (remember-lib.ts): signed
  // in with its password when the phone lost the secret, then read from the second account and put
  // back on when it is off. Refuses, typing nothing, while a password change is pending. Worst case
  // (s): env 1, stored 22, sign in 431, settled 60, the login list 100 and a sign-in from it 65,
  // switch 150, on second 1, ask 22, set 22, ask 22, stored 22 = 918.
  const repairRemember = async () => {
    const {secondUser} = loadE2EAccounts()
    const password = requirePhoneSecondPassword(loadE2EEnv())
    await repairRememberLeftOff({
      remember: async () => rememberPassphrase(),
      setRememberOn: async () => {
        await setRememberPassphrase(true)
      },
      signInWithPassword: async () => withLoginPasswordMarked(async () => restoreSecondSecret(password)),
      storedSecret: async () => storedSecretOf(secondUser),
      toSecond: async () => {
        if (!(await settledAppAccount()).loggedIn) {
          await pressBackToLoginList()
          await signInFromStoredSecret(secondUser)
        }
        await switchAppAccount(secondUser)
        // the service answers for the account signed in
        check(await onSecond(), 'the app is not on the second account to read its remember-password setting')
      },
    })
  }

  // A failed restore of an earlier run can leave the setting off (or the secret gone): put back here,
  // so the test starts from on. Mocha runs no afterEach when before() throws, so its repair runs under
  // the afterEach's own cleanups: the login-password mark cleared and the app put back on the smoke
  // account and read back (restoreToSmoke), whatever stopped it. Worst case (s): the block read 75,
  // repairRemember 918, the mark cleared 21, restoreToSmoke 275 = 1289.
  before(async function () {
    this.timeout(1_350_000)
    await withCleanup(
      async () => {
        await masked(async () => requireSecondNotBlocked())
        await repairRemember()
      },
      [clearLoginPasswordMark, restoreToSmoke]
    )
  })

  // -- what the afterEach puts back ---------------------------------------------------------------

  // set once the test may change the setting; the setting goes back on
  let changing = false

  // Bound: repairRemember 918.
  const restoreRemember = async () => {
    if (!changing) return
    await repairRemember()
    changing = false
  }

  // Worst case (s): the mark cleared 21, restoreRemember 918, restoreToSmoke 275, escapeToTabs 30 =
  // 1244.
  afterEach(async function () {
    this.timeout(1_300_000)
    await withCleanup(clearLoginPasswordMark, [restoreRemember, restoreToSmoke, escapeToTabs])
  })

  // -- the phone ----------------------------------------------------------------------------------

  // Settings > Advanced, with its "Always stay logged in" switch drawn (only for an account with a
  // password). Bound: 97.
  const openAdvanced = async () => {
    await escapeToTabs()
    await navigateToMore()
    await tapSettingsRow('Advanced')
    await expectScreen('the advanced settings', 'settingsTabs.advancedTab')
    await el(T.SETTINGS_REMEMBER_PASSWORD_SWITCH).waitForExist({timeout: 10_000})
  }

  // Taps the switch and waits for the phone's service to read `want`. Bound: 59.
  const tapRemember = async (want: boolean) => {
    const seq = await currentCallSeq()
    await el(T.SETTINGS_REMEMBER_PASSWORD_SWITCH).click()
    await waitForUiCall('the remember-password call to go out', seq, SET_REMEMBER)
    check((await uiCallCount(seq, SET_REMEMBER)) === 1, 'the switch sent the remember-password call more than once')
    await waitFor(
      `the phone to read the remember-password setting ${want ? 'on' : 'off'}`,
      async () => ((await rememberPassphrase()) === want ? true : undefined),
      {interval: 500, timeout: 20_000}
    )
  }

  it('Always stay logged in off, then on, each read back and through a relaunch', async function () {
    // worst case (s): peer 150, stored 22, switch 150, account 1, ask 22, advanced 126, step 2, tap 59,
    // step 2; relaunch 200, settled 60, stored 44, step 2, sign in 431, account 1, step 2; advanced
    // 126, ask 22, tap 59, step 2; relaunch 200, signed in 90, account 1, ask 22, stored 22, advanced
    // 126, step 2 = 1946
    this.timeout(1_950_000)
    const env = loadE2EEnv()
    const password = requirePhoneSecondPassword(env)
    const {secondUser, smokeUser} = loadE2EAccounts()
    // the relaunch with the setting off drops the stored secret, and only this password puts it back
    check(
      await masked(async () => secondPasswordIsCurrent(env, password)),
      "refusing to turn remember-password off: the second peer says KB_SECOND_PASSWORD in the env file is not its current password, so the phone's stored secret could not be put back"
    )
    check(await storedSecretOf(secondUser), 'the phone keeps no stored secret for the second account before the test')

    await switchAppAccount(secondUser)
    check(await onSecond(), 'the app did not switch to the second account')
    check(await rememberPassphrase(), 'the second account remember-password setting is not on before the test')
    changing = true
    await openAdvanced()
    await step('Advanced on the second account, Always stay logged in on')
    await tapRemember(false)
    await step('Always stay logged in off', {card: true})

    // off, the secret is kept in memory only: a relaunch loses it, so the second account is signed
    // out; the smoke account's is still stored, which anchors the read. The setting itself is read
    // once the second account is signed in again (the service answers for the account signed in).
    await relaunchApp()
    const after = await settledAppAccount()
    check(!(after.loggedIn && after.username === secondUser), 'the app signed the second account in after a relaunch with Always stay logged in off')
    check(await storedSecretOf(smokeUser), 'the phone lost the smoke account stored secret')
    check(!(await storedSecretOf(secondUser)), 'the phone kept the second account stored secret through a relaunch with Always stay logged in off')
    creditSurface('relaunch')
    await step('After a relaunch the second account is signed out')

    // the password, from the login screen; no step until the field is gone
    await withLoginPasswordMarked(async () => restoreSecondSecret(password))
    check(await onSecond(), 'the app is not on the second account after its password sign-in')
    await step('The second account signed in again with its password')

    await openAdvanced()
    check(!(await rememberPassphrase()), 'the remember-password setting is not off after the relaunch and the sign-in')
    await tapRemember(true)
    await step('Always stay logged in on again')

    // on, the stored secret signs the second account in after a relaunch
    await relaunchApp()
    await waitSignedIn()
    check(await onSecond(), 'the app is not on the second account after a relaunch with Always stay logged in on')
    check(await rememberPassphrase(), 'the remember-password setting is not on after the relaunch')
    check(await storedSecretOf(secondUser), 'the phone keeps no stored secret for the second account after the relaunch')
    await openAdvanced()
    changing = false
    await step('After a relaunch the second account signed itself in, Always stay logged in on')
  })
})
