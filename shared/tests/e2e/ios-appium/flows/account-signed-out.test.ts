import {loadE2EAccounts, loadE2EEnv, requireSecondPassword} from '../../accounts/env'
import {sayMasked} from '../../accounts/second-password-lib'
import {maskE2E} from '../../accounts/sweep-lib'
import {deviceNameCandidates} from '../../shared/peer-service'
import {e2eRunId} from '../../shared/run-marker'
import * as T from '../../shared/test-ids'
import {appAccount, asSecond, restoreToSmoke, signedOutThenBack} from '../gate/accounts'
import {backToScreen, pressBackToLoginList, swipeUpUntil, tapToScreen, waitForScreen} from '../gate/screens'
import {emptyLoginField, loginScreen, restoreSecondSecret, storedSecretOf} from '../gate/sign-in'
import {recoveryPicks, recoveryRowPredicate} from '../gate/signed-out-lib.ts'
import {manualEdge, step} from '../gate/step'
import {byText, el, enterText, labeled, maskingName} from '../helpers/elements'
import {waitFor} from '../helpers/lifecycle'
import {dismissKeyboard} from '../helpers/navigate'

// The login screen and the screens it opens while no account is signed in, each up to the edge where
// something would be sent or created: signup's last Continue (it signs up), "Start account reset" (it
// enters the reset pipeline) and the feedback form's Send are never pressed. Typed values are stamped
// names no account has, a taken name, malformed input, an example.com address and a well-formed paper
// key that is no one's; none is a secret. Each test signs the app out with "Log in as another user",
// which keeps every stored secret, and signs the smoke account back in from its row.
//
// Every timeout is the sum of the helpers' bounds (s): signing out (switcher 60, its tap and the login
// list 65) 125 and the restore 275 around every test; a tap to a screen 25 (5 tries of 5s), a back 100
// (5 of 20s), a typed field 52 (the field 10, twice enterText's clearFieldByKeys 16 and the read-back
// 5), the paper key field 36 (the field 10, clearFieldByKeys 16, the read-back 10), a swipe 3.

const SIGN_OUT_AND_BACK_MS = 400_000

const screenTap = async (text: string, screen: string) => tapToScreen(() => byText(text), screen)

// The fields typed() may type into: none of them ever holds a secret.
type PlainField =
  | typeof T.FORGOT_USERNAME_EMAIL_INPUT
  | typeof T.PROVISION_USERNAME_INPUT
  | typeof T.SIGNUP_DEVICE_NAME_INPUT
  | typeof T.SIGNUP_USERNAME_INPUT

// Refuses a value that is one of the env file's secrets, before it reaches a field, a log or an error.
const refuseSecret = (text: string) => {
  const env = loadE2EEnv()
  const secrets = [env.secondPassword, env.peers.owner.paperKey, env.peers.second.paperKey].filter((v): v is string => !!v)
  if (secrets.includes(text)) throw new Error('refusing to type an env file secret into a signed-out field')
}

// Types `text` into the field `id` and waits until the field reads it back. A screen's first field
// can drop what is typed while its screen is still sliding in, so it is typed once more; what the
// field read the first time is logged, and an error says what it reads last, both with the account
// names masked.
const typed = async (id: PlainField, text: string) => {
  refuseSecret(text)
  await el(id).waitForExist({timeout: 10_000, timeoutMsg: `the field ${id} never showed`})
  const reads = async () => (await el(id).getAttribute('value').catch(() => null)) === text
  for (let tries = 1; ; tries++) {
    await enterText(id, text)
    if (await waitFor(`the field ${id} to read what was typed`, async () => ((await reads()) ? true : undefined), {interval: 250, timeout: 5_000}).then(() => true, () => false)) return
    const got = JSON.stringify(await el(id).getAttribute('value').catch(() => null))
    if (tries >= 2) throw new Error(maskE2E(`the field ${id} reads ${got} after typing ${JSON.stringify(text)} twice`))
    sayMasked(`[account-signed-out] the field ${id} read ${got} after typing ${JSON.stringify(text)}; typing it again`)
  }
}

// The recovery's paper key field takes only the well-formed key no one has (wrongPaperKey): typed
// once, never retyped, and never logged or named in an error.
const typedPaperKey = async (text: string) => {
  refuseSecret(text)
  const id = T.RECOVER_PASSWORD_PAPER_KEY_INPUT
  await el(id).waitForExist({timeout: 10_000, timeoutMsg: `the field ${id} never showed`})
  await enterText(id, text)
  await waitFor(`the field ${id} to read what was typed`, async () => ((await el(id).getAttribute('value').catch(() => null)) === text ? true : undefined), {
    interval: 250,
    timeout: 10_000,
  })
}

const button = (label: string) => labeled('Button', label)

// A screen's button, with the keyboard down first: a field that has focus raises it over the
// screen's buttons and footer.
const press = async (label: string) => {
  await dismissKeyboard()
  await button(label).click()
}

// The username screen "Someone else..." opens: a login for an account the list does not have. Its
// row is one element whose label is its text, like the recovery rows.
const openUsernameScreen = async () => {
  await tapToScreen(() => browser.$(recoveryRowPredicate('Someone else...')), 'username')
  await el(T.PROVISION_USERNAME_INPUT).waitForExist({timeout: 10_000, timeoutMsg: 'the username screen has no username field'})
}

describe('account signed out', () => {
  it('feedback opens from the login screen and sends nothing', async function () {
    // the sign-out and back 400, a tap 25, the form 20, a back 100 = 545
    this.timeout(SIGN_OUT_AND_BACK_MS + 150_000)
    await signedOutThenBack(async () => {
      await screenTap('Problems logging in?', 'signupSendFeedbackLoggedOut')
      await el(T.SETTINGS_FEEDBACK).waitForExist({timeout: 10_000, timeoutMsg: 'the feedback screen has no form'})
      await button('Send').waitForExist({timeout: 10_000, timeoutMsg: 'the feedback form has no Send button'})
      await manualEdge('feedback-send')
      await pressBackToLoginList()
    })
  })

  it('forgot username answers for an example.com address', async function () {
    // the sign-out and back 400, two taps 50, a field 52, the answer 20 = 522
    this.timeout(SIGN_OUT_AND_BACK_MS + 140_000)
    await signedOutThenBack(async () => {
      await openUsernameScreen()
      await screenTap('Forgot username?', 'forgotUsername')
      // no account has an example.com address, so there is no one to send a username to
      await typed(T.FORGOT_USERNAME_EMAIL_INPUT, `e2e-${e2eRunId()}-fu@example.com`)
      await step('An example.com address typed')
      await press('Recover username')
      // the service answers an address no account has as it does any other
      await byText('We just sent you your username.').waitForExist({timeout: 20_000, timeoutMsg: 'the service never answered the username recovery'})
      await step('The service answered', {card: true})
    })
  })

  it('an unknown username shows the not-found banner', async function () {
    // the sign-out and back 400, a tap 25, a field 52, the answer 20 = 497
    this.timeout(SIGN_OUT_AND_BACK_MS + 120_000)
    const unknown = `e2e${e2eRunId()}nouser`
    await signedOutThenBack(async () => {
      await openUsernameScreen()
      await typed(T.PROVISION_USERNAME_INPUT, unknown)
      await step('An unknown username typed')
      await press('Log in')
      // the login fails as not found and the username screen comes back with its banner
      await byText("This username doesn't exist. Did you mean to").waitForExist({timeout: 20_000, timeoutMsg: 'the not-found banner never showed'})
      const params = await waitForScreen('username')
      expect(params).toMatchObject({username: unknown})
      expect(typeof params['inlineErrorCode']).toBe('number')
      expect(await appAccount()).toMatchObject({loggedIn: false})
      await step('Username not found', {card: true})
    })
  })

  it('signup checks the username and device name and stops before submitting', async function () {
    // the sign-out and back 400, a tap 25, the policy 10, five fields 260 with their answers 65, the
    // device name screen 20, two backs 200 = 980
    this.timeout(SIGN_OUT_AND_BACK_MS + 600_000)
    const {secondUser} = loadE2EAccounts()
    const fresh = `e2e${e2eRunId()}su`
    await signedOutThenBack(async () => {
      await screenTap('Create account', 'signupEnterUsername')
      await typed(T.SIGNUP_USERNAME_INPUT, secondUser)
      // the policy checkbox is in the screen's footer, under the keyboard
      await dismissKeyboard()
      await el(T.SIGNUP_EULA_CHECKBOX).click()
      // Continue stays disabled until the policy is accepted and a name typed
      await waitFor('Continue to be enabled', async () => ((await button('Continue').isEnabled()) ? true : undefined), {timeout: 10_000})
      await press('Continue')
      await byText('Sorry, this username is already taken. Did you mean to').waitForExist({timeout: 20_000, timeoutMsg: 'the taken-username banner never showed'})
      await step('Taken username')

      await typed(T.SIGNUP_USERNAME_INPUT, 'a b')
      await press('Continue')
      await byText('No spaces allowed').waitForExist({timeout: 5_000, timeoutMsg: 'the invalid-username banner never showed'})
      await step('Invalid username')

      // checkUsernameAvailable, a read, accepts a name no one has
      await typed(T.SIGNUP_USERNAME_INPUT, fresh)
      await press('Continue')
      expect(await waitForScreen('signupEnterDevicename')).toMatchObject({username: fresh})
      await step('Device name screen')

      const instructions = 'Your device name must have 3-64 characters and not end with punctuation.'
      await typed(T.SIGNUP_DEVICE_NAME_INPUT, 'e2e-')
      await byText(instructions).waitForExist({timeout: 5_000, timeoutMsg: 'a device name ending in punctuation was not refused'})
      await step('Device name refused')

      // the format the service checks on Continue; Continue itself would sign up
      await typed(T.SIGNUP_DEVICE_NAME_INPUT, `e2e-${e2eRunId()}-dev`)
      await byText(instructions).waitForExist({reverse: true, timeout: 5_000, timeoutMsg: 'a good device name was refused'})
      await byText('Your device name will be public and can not be changed in the future.').waitForExist({timeout: 5_000})
      await manualEdge('signup-submit')

      await backToScreen('signupEnterUsername')
      await pressBackToLoginList()
      await step('Back on the login screen', {card: true})
    })
  })

  // Forgot password for the second account, signed out from it so the login screen has it selected
  // (a tap on its row would sign it in from its stored secret). No real paper key is ever submitted.
  // Nothing here should drop the second account's stored secret, but if it is gone after a test the
  // afterEach signs it back in with KB_SECOND_PASSWORD, so this part types a secret: no retry (it
  // would type it again), and no step while the password is in the field.
  describe('forgot password', function () {
    this.retries(0)

    afterEach(async function () {
      // emptying the field 60, restoreSecondSecret 410 (secret read 20, settling 60, to the login
      // list 100, selecting the row 30, sign-in 150, secret stored 50), restoreToSmoke 275 = 745
      this.timeout(780_000)
      // a test mocha timed out never emptied it; secret-free, and nothing when it is not mounted
      await emptyLoginField()
      if (!(await storedSecretOf(loadE2EAccounts().secondUser))) await restoreSecondSecret(requireSecondPassword(loadE2EEnv()))
      // also when the secret is there: the test's own restore may have failed (a no-op on smoke)
      await restoreToSmoke()
    })

    const fromSecondsLoginScreen = async (f: () => Promise<void>) => {
      const {secondUser} = loadE2EAccounts()
      await asSecond(async () =>
        signedOutThenBack(async () => {
          expect(await loginScreen()).toMatchObject({needPassword: false, selectedUser: secondUser, state: 'shown'})
          await screenTap('Forgot password?', 'recoverPasswordDeviceSelector')
          await byText('Which do you have handy?').waitForExist({timeout: 20_000, timeoutMsg: 'the device selector never showed'})
          await f()
        })
      )
      // signing out with "Log in as another user" keeps it; nothing here may drop it
      expect(await storedSecretOf(secondUser)).toBe(true)
    }
    // around each: the switch to the second account 150, its settling 60, the stored-secret read 20
    const AS_SECOND_MS = SIGN_OUT_AND_BACK_MS + 230_000
    // A well-formed paper key (thirteen words from the word list, the last one carrying version 0)
    // that is no one's: the service's format checks pass, so it is refused by the key match itself.
    const wrongPaperKey = 'abandon ability able about above absent absorb abstract absurd abuse access accident acid'
    const row = (name: string) => () => browser.$(recoveryRowPredicate(name))

    it('lists the devices, explains one, and refuses a wrong paper key', async function () {
      // a tap 25, the selector 40, two scrolls 180, two taps 50, the explain screen 20, three backs
      // 300, the paper key field 36, the error 30 = 681
      this.timeout(AS_SECOND_MS + 700_000)
      await fromSecondsLoginScreen(async () => {
        const picks = recoveryPicks((await waitForScreen('recoverPasswordDeviceSelector'))['devices'], deviceNameCandidates('second'))
        if (typeof picks === 'string') throw new Error(picks)
        const {paperKey, peer} = picks
        await swipeUpUntil(row(peer.name), `the row of ${peer.name}`)
        await step("The second account's devices", {card: true})

        await tapToScreen(row(peer.name), 'recoverPasswordExplainDevice')
        expect(await waitForScreen('recoverPasswordExplainDevice')).toMatchObject({deviceName: peer.name})
        await button('Got it').waitForExist({timeout: 10_000, timeoutMsg: 'the explain screen has no Got it button'})
        await step('Device explained')

        // back starts the recovery again, at the device list
        await backToScreen('recoverPasswordDeviceSelector')
        // its name is the first two words of its phrase: no error names it
        await maskingName(paperKey.name, 'the paper key', async () => {
          await swipeUpUntil(row(paperKey.name), 'the paper key row')
          await tapToScreen(row(paperKey.name), 'recoverPasswordPaperKey')
        })
        await step('Paper key screen')

        await typedPaperKey(wrongPaperKey)
        await step('A paper key that is no one\'s typed')
        await press('Continue')
        const failed = await waitForScreen('recoverPasswordError', 30_000)
        expect(String(failed['error'])).toMatch(/no matching paper backup keys found/)
        await byText('Password recovery failed').waitForExist({timeout: 10_000, timeoutMsg: 'the error screen has no heading'})
        await step('Recovery failed')
        await pressBackToLoginList()
      })
    })

    it('lost all devices offers the account reset, which is never started', async function () {
      // a tap 25, a scroll 90, the prompt 20, two backs 200 = 335
      this.timeout(AS_SECOND_MS + 350_000)
      const {secondUser} = loadE2EAccounts()
      await fromSecondsLoginScreen(async () => {
        // one row whose label merges its two texts, like the device rows
        const lostAll = row('I lost all my devices/paper keys')
        await swipeUpUntil(lostAll, 'the row for losing every device')
        await tapToScreen(lostAll, 'recoverPasswordPromptResetAccount')
        expect(await waitForScreen('recoverPasswordPromptResetAccount')).toMatchObject({skipPassword: true, username: secondUser})
        await button('Start account reset').waitForExist({timeout: 15_000, timeoutMsg: 'the reset prompt has no Start account reset button'})
        await step('Reset prompt', {card: true})
        // back starts the recovery again; back once more cancels it
        await backToScreen('recoverPasswordDeviceSelector')
        await pressBackToLoginList()
      })
    })
  })
})
