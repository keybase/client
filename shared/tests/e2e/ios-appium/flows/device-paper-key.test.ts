import {newDeviceOf} from '../../accounts/device-targets'
import {loadE2EEnv} from '../../accounts/env'
import {forgetPaperKey, readPaperKeys, recordPaperKey} from '../../accounts/paper-key-ledger'
import {deviceHistory, listedDevices, requireRevocableFromPhone, revokeLeftoverFromPhoneFlow} from '../../shared/devices.ts'
import {e2eRunId} from '../../shared/run-marker'
import * as T from '../../shared/test-ids'
import {phoneDeviceId} from '../gate/accounts'
import {relaunchApp} from '../gate/device'
import {step} from '../gate/step'
import {findDeviceRow, labeled, openDevicePage, openDevices, revokeOnPhone, waitNotListedActive} from '../helpers/devices'
import {el} from '../helpers/elements'
import {waitFor} from '../helpers/lifecycle'

// Makes a paper key from the phone (Devices > Add > Create a paper key), records it in the paper key
// ledger at once (so a run that dies after this leaves it to the sweeper), then revokes it from the
// phone. Its words are on screen while the paper key screen is up, and nothing hides them there: no
// step, page source or label read runs until the screen has closed, and a screen that will not close
// is ended by relaunching the app before any failure screenshot. Nothing reads the words.
describe('device paper key', function () {
  this.retries(0)

  const words = () => el(T.DEVICES_PAPER_KEY_WORDS)
  const done = () => labeled('Button', 'Done')

  // Ticks "Yes, I wrote this down." (its switch: the label takes no tap) until Done can be tapped,
  // then taps Done. A tick before the words show does nothing (the switch is disabled until then).
  const acknowledgeAndClose = async () => {
    for (let ticks = 0; !(await done().isEnabled().catch(() => false)); ticks++) {
      if (ticks >= 3) throw new Error('Done never became tappable after ticking "Yes, I wrote this down." 3 times')
      await el(T.DEVICES_PAPER_KEY_WROTE_IT_DOWN).click()
      await done().waitForEnabled({timeout: 15_000}).catch(() => {})
    }
    await done().click()
  }

  // The paper key screen is gone, whatever happened on it: acknowledged and closed, or the app
  // relaunched (the screen has no other way out). Runs before any error leaves the test.
  const closePaperKeyScreen = async () => {
    if (!(await words().isExisting())) return
    await acknowledgeAndClose().catch(() => {})
    if (await words().waitForExist({reverse: true, timeout: 10_000}).then(() => true, () => false)) return
    await relaunchApp()
    if (await words().isExisting()) throw new Error('the paper key screen is still up after relaunching the app')
  }

  it('makes a paper key from the phone, then revokes it from its device page', async function () {
    this.timeout(420_000)
    const env = loadE2EEnv()
    const runId = e2eRunId()
    const phoneID = await phoneDeviceId()
    const before = await listedDevices()

    await openDevices()
    await labeled('Other', 'Add a device or paper key').click()
    await el(T.DEVICES_ADD_DEVICE).waitForExist({timeout: 15_000})
    await step('The add-a-device chooser')

    let made: {deviceID: string; name: string} | undefined
    let revokedByApp = false
    try {
      try {
        // sends login.paperKey, which makes the key, then shows its words
        await labeled('Other', 'Create a paper key').click()
        const listed = await waitFor(
          'the service to list a new paper key',
          async () => newDeviceOf(before, await listedDevices(), 'backup'),
          {interval: 1_000, timeout: 30_000}
        )
        // the ledger takes the name as deviceList gives it, which is what the sweeper compares
        recordPaperKey({deviceID: listed.deviceID, deviceName: listed.name, runId})
        const name = (await deviceHistory()).find(d => d.deviceID === listed.deviceID)?.name ?? ''
        if (!name) throw new Error('the new paper key has no device name in the device history')
        made = {deviceID: listed.deviceID, name}
        // the words box holds text once the key's words are shown (only the count of its texts is read)
        await waitFor(
          'the paper key screen to show the words',
          async () => ((await words().$$('-ios class chain:**/XCUIElementTypeStaticText').length) > 0 ? true : undefined),
          {interval: 500, timeout: 30_000}
        )
        await acknowledgeAndClose()
        await words().waitForExist({reverse: true, timeout: 10_000, timeoutMsg: 'the paper key screen stayed up after Done'})
      } finally {
        await closePaperKeyScreen()
      }
      const key = made
      await step('The paper key screen closed after "Yes, I wrote this down." and Done')

      await findDeviceRow(key.name)
      await step('The paper key is listed')
      await openDevicePage(key.name)
      await labeled('StaticText', 'Paper key').waitForExist({timeout: 10_000})
      if (!readPaperKeys().some(e => e.deviceID === key.deviceID && e.runId === runId)) {
        throw new Error('refusing to revoke: the paper key ledger has no entry for it from this run')
      }
      await requireRevocableFromPhone(env, key, phoneID)
      // sends revoke.revokeDevice
      await revokeOnPhone(key.name, 'paper key', async () => step('The revoke confirm names the paper key'))
      await waitNotListedActive(key.name)
      await waitFor(
        'the service to list the paper key as revoked',
        async () => ((await deviceHistory()).filter(d => d.deviceID === key.deviceID).map(d => d.revoked).join() === 'true' ? true : undefined),
        {interval: 1_000, timeout: 30_000}
      )
      revokedByApp = true
      await step('Back on the devices list, the paper key no longer active')
    } finally {
      if (made && !revokedByApp) await revokeLeftoverFromPhoneFlow(env, made, phoneID)
      if (made && (await deviceHistory()).find(d => d.deviceID === made?.deviceID)?.revoked) forgetPaperKey(made.deviceID)
    }
    expect(readPaperKeys().some(e => e.deviceID === made.deviceID)).toBe(false)
  })
})
