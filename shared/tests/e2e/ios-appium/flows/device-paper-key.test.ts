import {newDeviceOf, type ListedDevice} from '../../accounts/device-targets'
import {loadE2EEnv, type E2EEnv} from '../../accounts/env'
import {withCleanup} from '../../shared/cleanup.ts'
import {forgetPaperKey, readPaperKeys, recordPaperKey} from '../../accounts/paper-key-ledger'
import {deviceHistory, listedDevices, revokeLeftoverFromPhoneFlow} from '../../shared/devices.ts'
import {e2eRunId} from '../../shared/run-marker'
import * as T from '../../shared/test-ids'
import {phoneDeviceId} from '../gate/accounts'
import {relaunchApp} from '../gate/device'
import {clearSecretOnScreen, markSecretOnScreen} from '../gate/secret-screen.ts'
import {step} from '../gate/step'
import {findDeviceRow, openAddDevice, revokeFromDevicePage} from '../helpers/devices'
import {el, labeled} from '../helpers/elements'
import {waitFor} from '../helpers/lifecycle'

const PAPER_KEY_TEXT = '-ios predicate string:type == "XCUIElementTypeStaticText" AND label MATCHES "^[a-z]+( [a-z]+){5,}$"'

// Makes a paper key from the phone (Devices > Add > Create a paper key), records it in the paper key
// ledger at once (so a run that dies after this leaves it to the sweeper), then revokes it from the
// phone. Its words are on screen while the paper key screen is up, and nothing hides them there: no
// step, page source or label read runs until the screen has closed, and a screen that will not close
// is ended by relaunching the app before any failure screenshot. Nothing reads the words.
// the gate's secret-on-screen mark while the words may show
const PAPER_KEY_SCREEN = "the paper key's words"

describe('device paper key', function () {
  this.retries(0)

  const words = () => el(T.DEVICES_PAPER_KEY_WORDS)
  const done = () => labeled('Button', 'Done')

  // Ticks "Yes, I wrote this down." (its switch: the label takes no tap) until Done can be tapped,
  // then taps Done. A disabled Done renders a plain view, not a button, so Done exists only once it
  // can be tapped. A tick before the words show does nothing (the switch is disabled until then).
  const acknowledgeAndClose = async () => {
    for (let ticks = 0; !(await done().isExisting()); ticks++) {
      if (ticks >= 3) throw new Error('Done never became tappable after ticking "Yes, I wrote this down." 3 times')
      await el(T.DEVICES_PAPER_KEY_WROTE_IT_DOWN).click()
      await done().waitForExist({timeout: 15_000}).catch(() => {})
    }
    await done().click()
  }

  // The paper key screen is gone, whatever happened on it: acknowledged and closed, or the app
  // relaunched (the screen has no other way out). Runs before any error leaves the test. Once it is
  // gone, the gate's secret-on-screen mark is cleared; a screen still up keeps it.
  const closePaperKeyScreen = async () => {
    if (await words().isExisting()) {
      await acknowledgeAndClose().catch(() => {})
      if (!(await words().waitForExist({reverse: true, timeout: 10_000}).then(() => true, () => false))) {
        await relaunchApp()
        if (await words().isExisting()) throw new Error('the paper key screen is still up after relaunching the app')
      }
    }
    clearSecretOnScreen(PAPER_KEY_SCREEN)
  }

  // What the test made, for its cleanup and the afterEach: set once `before` is read, before the key
  // can exist.
  type Made = {deviceID: string; name: string}
  type Run = {before: Array<ListedDevice>; env: E2EEnv; made?: Made; phoneID: string; retired: boolean; revokedByApp: boolean; runId: string}
  let run: Run | undefined

  // The run's new paper key, ledgered the moment the service lists it (whether or not its name can
  // be read yet), then named as deviceHistoryList names it (the list's row shows that name).
  const findMade = async (r: Run) => {
    const listed = newDeviceOf(r.before, await listedDevices(), 'backup')
    if (!listed) return undefined
    // the ledger takes the name as deviceList gives it, which is what the sweeper compares; a key
    // seen again (a names file write that failed) is recorded again
    recordPaperKey({deviceID: listed.deviceID, deviceName: listed.name, runId: r.runId})
    const name = (await deviceHistory()).find(d => d.deviceID === listed.deviceID)?.name
    if (!name) return undefined
    r.made = {deviceID: listed.deviceID, name}
    return r.made
  }

  // A key the app did not revoke (the test failed first) is found again by diffing the service's
  // list against `before`, ledgered, and revoked through the main service under the phone's guard.
  // Idempotent: the test's own cleanup and the afterEach both run it. Worst case (s): naming 15,
  // the revoke and its check 30 = 45.
  const retire = async (r: Run) => {
    if (r.retired) return
    if (!r.made) await waitFor('the run\'s paper key to be listed and named', async () => findMade(r), {interval: 1_000, timeout: 15_000}).catch(() => undefined)
    const key = r.made
    if (!key) {
      const had = new Set(r.before.map(d => d.deviceID))
      const left = (await listedDevices()).filter(d => d.type === 'backup' && !had.has(d.deviceID))
      if (left.length) throw new Error(`${left.length} new paper key(s) are listed that this test could not name, so it did not revoke them`)
      r.retired = true
      return
    }
    if (!r.revokedByApp) await revokeLeftoverFromPhoneFlow(r.env, key, r.phoneID)
    if (!(await deviceHistory()).find(d => d.deviceID === key.deviceID)?.revoked) throw new Error('the paper key is still active after its cleanup')
    forgetPaperKey(key.deviceID)
    r.retired = true
  }

  // Mocha runs this before the gate's own afterEach (and its failure screenshot), also after a
  // timeout that abandoned the test before its cleanup: the words go first, then the key.
  afterEach(async function () {
    // closing the screen 130 (acknowledging 50, its close 10, a relaunch 70), retire 45 = 175
    this.timeout(240_000)
    await closePaperKeyScreen()
    const r = run
    run = undefined
    if (r) await retire(r)
  })

  it('makes a paper key from the phone, then revokes it from its device page', async function () {
    // Worst case from the helpers' bounds (s), so the cleanups always get to run: the phone's device
    // 15, the device list before 15, openAddDevice 94 (openDevices 74, the chooser 20), the key
    // listed and named 30, the words 30, acknowledging 50, the screen closing 10, findDeviceRow 250,
    // revokeFromDevicePage 470, three steps 15 = 979. Cleanups: closing the screen 130, retire 45 =
    // 175. Total 1154.
    this.timeout(1_220_000)
    const env = loadE2EEnv()
    const runId = e2eRunId()
    const phoneID = await phoneDeviceId()
    const r: Run = {before: await listedDevices(), env, phoneID, retired: false, revokedByApp: false, runId}
    run = r

    await openAddDevice()
    await step('The add-a-device chooser')

    await withCleanup(
      async () => {
        await withCleanup(
          async () => {
            // sends login.paperKey, which makes the key, then shows its words
            markSecretOnScreen(PAPER_KEY_SCREEN)
            await labeled('Other', 'Create a paper key').click()
            await waitFor('the service to list a new, named paper key', async () => findMade(r), {interval: 1_000, timeout: 30_000})
            // The words' text is not a descendant of the words box in the accessibility tree (the box is
            // a leaf), so the screen is matched by a text shaped like the words: lowercase words, one
            // space apart. The query returns element ids only; nothing reads the text.
            await waitFor(
              'the paper key screen to show the words',
              async () => ((await words().isExisting()) && (await browser.$$(PAPER_KEY_TEXT).length) > 0 ? true : undefined),
              {interval: 500, timeout: 30_000}
            )
            await acknowledgeAndClose()
            await words().waitForExist({reverse: true, timeout: 10_000, timeoutMsg: 'the paper key screen stayed up after Done'})
          },
          [closePaperKeyScreen]
        )
        const key = r.made
        if (!key) throw new Error('the paper key was never named')
        await step('The paper key screen closed after "Yes, I wrote this down." and Done')
        // its name is the first two words of its phrase: nothing names it in an error
        const listed = {label: 'the new paper key', name: key.name}

        await findDeviceRow(listed)
        await step('The paper key is listed')
        await revokeFromDevicePage(env, {deviceID: key.deviceID, shown: listed}, 'paper key', phoneID, {
          beforeRevoke: () => {
            if (!readPaperKeys().some(e => e.deviceID === key.deviceID && e.runId === runId)) {
              throw new Error('refusing to revoke: the paper key ledger has no entry for it from this run')
            }
          },
          pageStep: ["The paper key's device page"],
        })
        r.revokedByApp = true
      },
      [async () => retire(r)]
    )
    expect(readPaperKeys().some(e => e.deviceID === r.made?.deviceID)).toBe(false)
  })
})
