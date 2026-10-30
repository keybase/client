import {loadE2EAccounts, loadE2EEnv, requireSecondPassword} from '../../accounts/env'
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

  it('the second account signs out, a wrong password is refused, and its password signs it back in', async function () {
    // switches, a sign-out, two sign-ins, and the cleanup's own sign-in and switch
    this.timeout(480_000)
    const password = requireSecondPassword(loadE2EEnv())
    const {secondUser, smokeUser} = loadE2EAccounts()
    await withCleanup(
      async () => {
        if (!(await storedSecretOf(secondUser))) {
          throw new Error('the phone keeps no stored secret for the second account at the start; the cleanup signs it in with its password')
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
        expect(await rowShows(T.ACCOUNT_SWITCHER_ROW_PREFIX + secondUser, 'Signed out')).toBe(false)
        await step('Back on the smoke account, the switcher lists the second account signed in')
        await escapeToTabs()
      },
      [async () => restoreSecondSecret(password), restoreToSmoke]
    )
    expect(await storedSecretOf(secondUser)).toBe(true)
  })
})
