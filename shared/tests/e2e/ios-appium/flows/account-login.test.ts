import {loadE2EAccounts, loadE2EEnv, requireSecondPassword} from '../../accounts/env'
import {secondPasswordIsCurrent} from '../../accounts/second-password-lib'
import {withCleanup} from '../../shared/cleanup.ts'
import * as T from '../../shared/test-ids'
import {appAccount, restoreToSmoke} from '../gate/accounts'
import {fieldLength} from '../gate/secret-input'
import {
  emptyLoginField,
  loginScreen,
  restoreSecondSecret,
  rowShows,
  signInWithPassword,
  storedSecretOf,
  submitLoginPassword,
  waitPasswordScreenFor,
  waitStoredSecret,
} from '../gate/sign-in'
import {step} from '../gate/step'
import {openAccountSwitcher, switchAppAccount} from '../helpers/chat'
import {byText, el} from '../helpers/elements'
import {waitFor} from '../helpers/lifecycle'
import {escapeToTabs, navigateToMore, tapSettingsRow} from '../helpers/navigate'

// The second account signs out from Settings ("Just sign out", which drops its stored secret on the
// phone), is refused a wrong password, and signs back in with its password, KB_SECOND_PASSWORD,
// which only submitSecret puts into the login field (no step or page read while the field holds
// it). The password sign-in stores the secret again. The cleanup puts it back when the test stopped
// before that, signing in with the password the same way, then puts the app back on smoke.
describe('account login', function () {
  // a retry would type the password again
  this.retries(0)

  // A test mocha timed out never ran its cleanup, which empties the field: empty it before the
  // gate's failure screenshot. Secret-free, and nothing when the field is not mounted.
  afterEach(async function () {
    this.timeout(60_000)
    await emptyLoginField()
  })

  it('the second account signs out, a wrong password is refused, and its password signs it back in', async function () {
    // Worst case from the helpers' bounds (s), so the cleanup always gets to run. Before it: the
    // password check on the second peer 150 (its service start 30, two whoamis 30, the check 60,
    // connecting 30). Body: stored-secret
    // read 20, switch to second 150 (switcher 60, the switch 60, escapeToTabs 30), Settings and the
    // sign-out screen 64, signed out 190 (list 60, signed out 30, secret dropped 50, password screen
    // 30, two row reads 20), wrong password 120 (submit 70, banner 30, emptying 20), password sign-in
    // 200 (submit 70, sign-in 60, emptying 20, secret stored 50), back to smoke 260 (switch 150,
    // switcher 60, two row reads 20, escapeToTabs 30) = 1004. Cleanup: restoreSecondSecret 410
    // (secret read 20, settling 60, to the login list 100, selecting the row 30, sign-in 150, secret
    // stored 50), restoreToSmoke 275 (settling 60, a sign-in from the login list 215) = 685.
    // Total 1839.
    this.timeout(1_900_000)
    const env = loadE2EEnv()
    const password = requireSecondPassword(env)
    const {secondUser, smokeUser} = loadE2EAccounts()
    // "Just sign out" drops the phone's stored secret, and only this password puts it back: prove
    // it is current first, on the second peer, before anything changes
    if (!(await secondPasswordIsCurrent(env, password))) {
      throw new Error(
        "refusing to sign the second account out: the second peer says KB_SECOND_PASSWORD in the env file is not its current password, so the phone's stored secret could not be put back"
      )
    }
    await withCleanup(
      async () => {
        if (!(await storedSecretOf(secondUser))) {
          throw new Error(
            'precondition failed: the phone kept no stored secret for the second account when the test started, so the run fails here; the cleanup signs it in with its password to repair it'
          )
        }
        await switchAppAccount(secondUser)
        expect(await appAccount()).toMatchObject({loggedIn: true, switching: false, username: secondUser})
        await navigateToMore()
        await tapSettingsRow('Sign out')
        await byText('You will need it to sign back in.').waitForExist({timeout: 10_000, timeoutMsg: 'the sign-out screen never showed'})
        await step('On the second account, the sign-out screen asks to test the password first')

        // sends login.logout with keepSecrets false: the phone forgets the second account's secret
        await byText('Just sign out').click()
        await el(T.LOGIN_USER_LIST).waitForExist({timeout: 60_000, timeoutMsg: 'the login screen never showed after signing out'})
        await waitFor('the app to sign out', async () => ((await appAccount()).loggedIn ? undefined : true), {interval: 500, timeout: 30_000})
        await waitStoredSecret(secondUser, false)
        // the account that signed out is the one selected, and it needs its password now
        await waitPasswordScreenFor(secondUser)
        expect(await rowShows(T.LOGIN_USER_ROW_PREFIX + secondUser, 'Signed out')).toBe(true)
        expect(await rowShows(T.LOGIN_USER_ROW_PREFIX + smokeUser, 'Signed in')).toBe(true)
        await step('Signed out, the login screen asks for the second account password')

        // a dummy, not a secret: the screenshot below may show its dots
        await submitLoginPassword(secondUser, `e2e-not-the-password-${Date.now()}`)
        await byText('Incorrect password.').waitForExist({timeout: 30_000, timeoutMsg: 'the login screen never said the password was wrong'})
        expect(await loginScreen()).toMatchObject({error: 'Incorrect password.', selectedUser: secondUser, state: 'shown'})
        expect(await appAccount()).toMatchObject({loggedIn: false})
        await step('The wrong password is refused')
        // the screen forgets the wrong password; its field, which takes no value prop, keeps it
        await emptyLoginField()
        expect(await fieldLength(T.LOGIN_PASSWORD_INPUT)).toBe(0)

        // no step or page read until the field is gone (signInWithPassword empties it on a failure)
        await signInWithPassword(secondUser, password)
        await waitStoredSecret(secondUser, true)
        await step('Signed in again as the second account with its password', {card: true})

        await switchAppAccount(smokeUser)
        await openAccountSwitcher()
        // the row's text is read at all (its name), so not showing "Signed out" means something
        expect(await rowShows(T.ACCOUNT_SWITCHER_ROW_PREFIX + secondUser, secondUser)).toBe(true)
        expect(await rowShows(T.ACCOUNT_SWITCHER_ROW_PREFIX + secondUser, 'Signed out')).toBe(false)
        await step('Back on the smoke account, the switcher lists the second account signed in')
        await escapeToTabs()
      },
      [async () => restoreSecondSecret(password), restoreToSmoke]
    )
    expect(await storedSecretOf(secondUser)).toBe(true)
  })
})
