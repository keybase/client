import {evalInPage, inspectorPageFor} from '../../shared/metro-eval'
import {escapeToTabs, navigateToMore, navigateToPeople, tapSettingsRow} from '../helpers/navigate'
import {loadE2EAccounts} from '../../accounts/env'
import {appAccount, asSecond, signedOutThenBack} from '../gate/accounts'
import {byText, el} from '../helpers/elements'
import * as T from '../../shared/test-ids'
import {beginErrorCapture, takeErrors} from '../gate/errors'
import {step} from '../gate/step'
import {emptySecretField, fieldLength, focusSecretField, submitSecret} from '../gate/secret-input'

describe('harness helpers', () => {
  it('opens Settings by the tab bar and comes back', async () => {
    await navigateToMore()
    await step('Opened the Settings tab', {card: true})
    await navigateToPeople()
    await step('Back on the People tab')
  })

  it('collects the app console errors and clears them', async () => {
    const marker = `harness-helpers console.error ${Date.now()}`
    await beginErrorCapture()
    await evalInPage(await inspectorPageFor(process.env['KB_IOS_DEVICE'] ?? 'iPhoneTest', 'keybase.ios'), `console.error(${JSON.stringify(marker)}); return null`)
    expect(await takeErrors()).toEqual([marker])
    expect(await takeErrors()).toEqual([])
  })

  it('runs a part as the second account and comes back to the smoke account', async () => {
    const {secondUser, smokeUser} = loadE2EAccounts()
    await asSecond(async () => {
      expect((await appAccount()).username).toBe(secondUser)
      await step('Signed in as the second account')
    })
    expect((await appAccount()).username).toBe(smokeUser)
  })

  it('shows the login list signed out and comes back to the smoke account', async () => {
    const {smokeUser} = loadE2EAccounts()
    await signedOutThenBack(async () => {
      await el(T.LOGIN_USER_LIST).waitForExist({timeout: 10_000})
      await step('The login screen lists the accounts')
    })
    expect(await appAccount()).toMatchObject({loggedIn: true, username: smokeUser})
  })
})

// Puts a secret into a field: no retry (a retry would type it again) and no step screenshot while
// the field holds it. The value is a dummy and the screen is left without saving.
describe('harness secret entry', function () {
  this.retries(0)

  it('puts a dummy secret into the new password field from inside the app, then empties it', async () => {
    const dummy = `not-a-password-${Date.now()}`
    await navigateToMore()
    await tapSettingsRow('Account')
    await el(T.SETTINGS_ACCOUNT_PAGE).waitForExist({timeout: 10_000})
    // a phone shows "Change" for an account with a password, "Set a password" for one without
    const open = (await byText('Change').isExisting()) ? byText('Change') : byText('Set a password')
    await open.click()
    await el(T.SETTINGS_NEW_PASSWORD_INPUT).waitForExist({timeout: 10_000})
    await focusSecretField(T.SETTINGS_NEW_PASSWORD_INPUT)
    await step('The new password field is focused')

    const wrong = await submitSecret(T.LOGIN_PASSWORD_INPUT, dummy).then(
      () => undefined,
      (e: unknown) => (e instanceof Error ? e.message : String(e))
    )
    expect(wrong).toBe(`the focused text field is ${T.SETTINGS_NEW_PASSWORD_INPUT}, not ${T.LOGIN_PASSWORD_INPUT}`)
    expect(await fieldLength(T.SETTINGS_NEW_PASSWORD_INPUT)).toBe(0)

    try {
      await submitSecret(T.SETTINGS_NEW_PASSWORD_INPUT, dummy)
      expect(await fieldLength(T.SETTINGS_NEW_PASSWORD_INPUT)).toBe(dummy.length)
    } finally {
      await emptySecretField(T.SETTINGS_NEW_PASSWORD_INPUT)
    }
    await step('The new password field is empty again')
    await escapeToTabs()
  })
})
