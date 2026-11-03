import {escapeToTabs, navigateToMore, navigateToPeople, tapSettingsRow} from '../helpers/navigate'
import {loadE2EAccounts, loadE2EEnv} from '../../accounts/env'
import {activeDevices, mainDevice, requireRevocableFromPhone} from '../../shared/devices.ts'
import {appAccount, phoneDevice, signedOutThenBack} from '../gate/accounts'
import {byText, el} from '../helpers/elements'
import * as T from '../../shared/test-ids'
import {beginErrorCapture, takeErrors} from '../gate/errors'
import {screenName, swipeUpUntil, tapToScreen} from '../gate/screens'
import {step} from '../gate/step'
import {openLink, relaunchApp, setPasteboard} from '../gate/device'
import {attemptRecording} from '../gate/recording'
import {creditSurface} from '../gate/attempt'
import {appSnapshot, jsEval, waitFor} from '../helpers/lifecycle'
import {emptySecretField, fieldLength, focusSecretField, submitSecret} from '../gate/secret-input'

describe('harness helpers', () => {
  it('collects the app console errors and clears them', async () => {
    const marker = `harness-helpers console.error ${Date.now()}`
    await beginErrorCapture()
    await jsEval(`console.error(${JSON.stringify(marker)}); return null`)
    expect(await takeErrors()).toContain(marker)
    expect(await takeErrors()).not.toContain(marker)
  })
})

// restoreToSmoke from each signed-out screen the account flows reach: each part ends on the screen,
// and signedOutThenBack's restore backs out of it (through native bar Back items, which take no
// testID) and signs the smoke account back in.
describe('harness restore from signed-out screens', () => {
  const restoresFrom = async (open: () => Promise<void>, what: string) => {
    const {smokeUser} = loadE2EAccounts()
    await signedOutThenBack(async () => {
      await open()
      await step(what)
    })
    expect(await appAccount()).toMatchObject({loggedIn: true, switching: false, username: smokeUser})
    expect(await screenName()).not.toMatch(/^(login|recoverPassword|username|signup)/)
    await step('Back on the smoke account')
  }

  const CASES: Array<[string, () => Promise<void>, string]> = [
    [
      'a recover-password sub-screen',
      async () => {
        await tapToScreen(() => byText('Forgot password?'), 'recoverPasswordDeviceSelector')
        // the reset row ends a list of every device the account has
        const reset = () => byText('I lost all my devices/paper keys')
        await swipeUpUntil(reset, 'the account reset row', 60)
        await tapToScreen(reset, 'recoverPasswordPromptResetAccount')
        await byText('Start account reset').waitForExist({timeout: 15_000})
      },
      'Recover password offers the account reset, two screens over the login screen',
    ],
    ['the username screen', async () => tapToScreen(() => byText('Someone else...'), 'username'), 'The username screen is over the login screen'],
    [
      'the logged-out feedback screen',
      async () => tapToScreen(() => byText('Problems logging in?'), 'signupSendFeedbackLoggedOut'),
      'The feedback screen is over the login screen',
    ],
    [
      'the signup username screen',
      async () => tapToScreen(() => byText('Create account'), 'signupEnterUsername'),
      'The signup username screen is over the login screen',
    ],
  ]
  for (const [screen, open, what] of CASES) {
    it(`backs out of ${screen}`, async () => restoresFrom(open, what))
  }
})

describe('harness device helpers', () => {
  it("reads the phone's own device, which the service lists and the revoke check refuses", async () => {
    const env = loadE2EEnv()
    const phone = await phoneDevice()
    const listed = (await activeDevices()).filter(d => d.deviceID === phone.deviceID)
    expect(listed.map(d => d.name)).toEqual([phone.deviceName])
    const refusal = async (expected: {deviceID: string; name: string}) =>
      requireRevocableFromPhone(env, expected, phone.deviceID).then(
        () => 'allowed',
        (e: unknown) => (e instanceof Error ? e.message : String(e))
      )
    expect(await refusal({deviceID: phone.deviceID, name: phone.deviceName})).toBe("refusing to revoke: it is the phone's own device")
    const host = await mainDevice()
    expect(await refusal(host)).toBe("refusing to revoke: it is the main service's own device")
  })
})

describe('harness simulator helpers', () => {
  it('opens a deep link to the screen the app routes it to', async () => {
    openLink('keybase://devices')
    const screen = await waitFor(
      'the devices screen',
      async () => {
        const {screen} = await appSnapshot()
        return screen?.name === 'settingsTabs.devicesTab' ? screen : undefined
      },
      {interval: 500, timeout: 20_000}
    )
    expect(screen.name).toBe('settingsTabs.devicesTab')
    creditSurface('deep-link')
    await step('The devices link opened the Devices screen')
    await escapeToTabs()
  })

  // setPasteboard reads the text back from the simulator's pasteboard itself. The app never pastes it
  // here, so nothing credits the pasteboard surface.
  it('writes the pasteboard text and reads it back', async () => {
    await setPasteboard('harness pasteboard "quoted" $HOME and a backslash \\ filler')
  })

  it('relaunches the app and keeps recording across the new runtime', async () => {
    const rec = attemptRecording()
    await navigateToMore()
    // the recording restarts on the Settings tab, so what relaunchApp keeps from the first runtime
    // starts there whichever tab the attempt began on
    await rec.checkpoint()
    await relaunchApp()
    expect(rec.reloadCount).toBe(1)
    expect(rec.recordings.at(-1)?.startRoutes).toContain('settingsRoot')
    await navigateToPeople()
    await rec.checkpoint()
    expect(rec.recordings.flatMap(r => r.routes)).toContain('peopleRoot')
    creditSurface('relaunch')
    await step('On the People tab after the relaunch')
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
