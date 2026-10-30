import {escapeToTabs, navigateToMore, navigateToPeople, tapSettingsRow} from '../helpers/navigate'
import {byText, el} from '../helpers/elements'
import * as T from '../../shared/test-ids'
import {beginErrorCapture, takeErrors} from '../gate/errors'
import {step} from '../gate/step'
import {openLink, relaunchApp, setPasteboard} from '../gate/device'
import {attemptRecording} from '../gate/recording'
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
    await step('The devices link opened the Devices screen')
    await escapeToTabs()
  })

  // Appium's own setPasteboard backs pasteText, and `simctl pbpaste` reads back empty on this host's
  // simulators, so reading the text back is not possible; this checks the stdin write is accepted.
  // The app never reads it here, so nothing credits the pasteboard surface.
  it('writes the pasteboard text over stdin', () => {
    expect(() => setPasteboard(`harness pasteboard "quoted" $HOME ${Date.now()}`)).not.toThrow()
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
