// Settings > Files on the phone: the low-space warning switch (off, then on), the threshold picked
// from the picker sheet, and the mobile-network sync switch, each read back from the phone's own
// service, then read again after a relaunch. These settings live on the phone, so they are read and
// put back through its service (never the host's); the flow's afterEach puts them back as they were.
import {withCleanup} from '../../shared/cleanup.ts'
import * as T from '../../shared/test-ids'
import {requireAppIsSmoke} from '../gate/accounts'
import {filesSettings, setFilesSettings, type FilesSettings} from '../gate/app-ask'
import {labelHas} from '../gate/page-source-lib'
import {creditSurface} from '../gate/attempt'
import {currentCallSeq, waitForUiCall} from '../gate/recorder'
import {step} from '../gate/step'
import {expectPersists} from '../helpers/chat'
import {el} from '../helpers/elements'
import {waitFor} from '../helpers/lifecycle'
import {check, labelledElement} from '../helpers/menus'
import {escapeToTabs} from '../helpers/navigate'
import {openSettingsPage} from '../helpers/settings'

const GB = 1024 ** 3
const THRESHOLDS: ReadonlyArray<{bytes: number; label: string}> = [
  {bytes: GB, label: '1 GB'},
  {bytes: 3 * GB, label: '3 GB'},
]

describe('files settings', function () {
  // the phone's files settings before the test changed them
  let before: FilesSettings | undefined

  // Bound: smoke 10, then a set 25 and a read 25.
  const restoreSettings = async () => {
    if (before === undefined) return
    await requireAppIsSmoke()
    const want = before
    const same = (s: FilesSettings) =>
      s.spaceAvailableNotificationThreshold === want.spaceAvailableNotificationThreshold && s.syncOnCellular === want.syncOnCellular
    if (!same(await filesSettings())) await setFilesSettings(want)
    check(same(await filesSettings()), "the phone's files settings did not go back")
    before = undefined
  }

  // The settings put back whatever the test did, after a timeout too. Worst case (s): smoke 10, the
  // restore 50 (a read 25 and the set 25), its read 25, escape 30 = 115 (the first read is the same).
  afterEach(async function () {
    this.timeout(180_000)
    await withCleanup(restoreSettings, [escapeToTabs])
  })

  // Settings > Files. Bound: openSettingsPage 97, the warn switch 10 = 107.
  const openFilesSettings = async () => {
    await openSettingsPage('Files', 'settingsTabs.fsTab', T.SETTINGS_FILES, T.SETTINGS_ROW_FILES)
    await el(T.SETTINGS_FILES_WARN_SWITCH).waitForExist({timeout: 10_000})
  }

  // Waits for the phone's service to read settings `ok` takes. Bound: 20s of tries, overrun by one
  // ask 25 = 45.
  const expectSettings = async (what: string, ok: (s: FilesSettings) => boolean) =>
    waitFor(what, async () => (ok(await filesSettings()) ? true : undefined), {interval: 500, timeout: 20_000})

  // Taps the warn switch and waits for the threshold the phone's service reads. Bound: the tap 1,
  // calls 12 (10, its read 2), expectSettings 45 = 58.
  const tapWarn = async (what: string, ok: (threshold: number) => boolean) => {
    const seq = await currentCallSeq()
    await el(T.SETTINGS_FILES_WARN_SWITCH).click()
    await waitForUiCall(`the ${what} to go out`, seq, 'keybase.1.SimpleFS.simpleFSSetNotificationThreshold')
    await expectSettings(`the phone to read the warning ${what}`, s => ok(s.spaceAvailableNotificationThreshold))
  }

  it('the low-space warning, its threshold and the mobile-network sync are set and stay through a relaunch', async function () {
    // worst case (s): smoke 10, app 25, open 107, the warn taps 3 * 58 = 174, the threshold (a read
    // 25, the tap 1, the prompt 10, the sheet settled 10, the wheel 10, the pick 15, the wheel showing it 5, Done 6, the
    // sheet gone 10, calls 12, expectSettings 45) = 149, the cellular switch (the tap 1, calls 12,
    // expectSettings 45) = 58, steps 4 * 2 = 8; relaunch 200, signed in 90, open 107, smoke 10, app
    // 25, the shown threshold 1, step 2 = 435; = 966
    this.timeout(1_000_000)
    await requireAppIsSmoke()
    const original = await filesSettings()
    before = original
    await openFilesSettings()

    // the warning off and on, whichever it starts: from off, it is turned on first, so both ways are
    // taken
    if (original.spaceAvailableNotificationThreshold === 0) await tapWarn('turned on', t => t > 0)
    await tapWarn('turned off', t => t === 0)
    await tapWarn('turned on', t => t > 0)
    await step('The warning off and on again')

    // a threshold other than the one shown, from the picker sheet
    const now = await filesSettings()
    const want = THRESHOLDS.find(t => t.bytes !== now.spaceAvailableNotificationThreshold)!
    const seq = await currentCallSeq()
    await el(T.SETTINGS_FILES_THRESHOLD).click()
    const prompt = '-ios predicate string:label == "Pick a threshold" AND visible == 1'
    const promptEl = await waitFor('the threshold prompt', async () => labelledElement(prompt, 'Pick a threshold', 'the threshold prompt').catch(() => undefined), {
      interval: 250,
      timeout: 10_000,
    })
    // the wheel is not read until the sheet has stopped moving: an accessibility read of it
    // mid-animation can crash the app
    let lastRect: string | undefined
    await waitFor(
      'the threshold sheet to settle',
      async () => {
        const rect = JSON.stringify({...(await promptEl.getLocation()), ...(await promptEl.getSize())})
        const settled = rect === lastRect
        lastRect = rect
        return settled ? true : undefined
      },
      {interval: 250, timeout: 10_000}
    )
    const wheel = '-ios predicate string:type == "XCUIElementTypePickerWheel" AND visible == 1'
    await browser.$(wheel).waitForExist({timeout: 10_000})
    // turned a row at a time toward the threshold (the wheel lists them smallest first and opens on
    // the one set), never WDA's setValue: see enterText
    await browser.execute('mobile: selectPickerWheelValue', {
      elementId: await browser.$(wheel).elementId,
      maxAttempts: 5,
      offset: 0.15,
      order: want.bytes > now.spaceAvailableNotificationThreshold ? 'next' : 'previous',
      value: want.label,
    })
    await waitFor(
      'the wheel to show the threshold',
      async () => ((await browser.$(wheel).getAttribute('value').catch(() => null)) === want.label ? true : undefined),
      {interval: 250, timeout: 5_000}
    )
    const done = await waitFor('the threshold sheet Done', async () => labelledElement('-ios predicate string:label == "Done" AND visible == 1', 'Done', 'the Done of the sheet', {forTap: true}).catch(() => undefined), {
      interval: 250,
      timeout: 5_000,
    })
    await done.click()
    await browser.$(wheel).waitForExist({reverse: true, timeout: 10_000})
    await waitForUiCall('the threshold to go out', seq, 'keybase.1.SimpleFS.simpleFSSetNotificationThreshold')
    await expectSettings('the phone to read the threshold', s => s.spaceAvailableNotificationThreshold === want.bytes)
    await step('A threshold picked')

    // the mobile-network sync switched the other way
    const cellular = !original.syncOnCellular
    const seq2 = await currentCallSeq()
    await el(T.SETTINGS_FILES_CELLULAR_SWITCH).click()
    await waitForUiCall('the cellular sync to go out', seq2, 'keybase.1.SimpleFS.simpleFSSetSyncOnCellular')
    await expectSettings('the phone to read the cellular sync', s => s.syncOnCellular === cellular)
    await step('Mobile-network sync switched', {card: true})

    // the values are the app's after a relaunch, and the screen shows the threshold
    await expectPersists(
      'the files settings',
      async () => {
        await requireAppIsSmoke()
        await openFilesSettings()
        const s = await filesSettings()
        check(labelHas((await el(T.SETTINGS_FILES_THRESHOLD).getAttribute('label')) ?? '', want.label), 'the threshold the screen shows is not the one picked')
        return {cellular: s.syncOnCellular, threshold: s.spaceAvailableNotificationThreshold}
      },
      {cellular, threshold: want.bytes}
    )
    creditSurface('relaunch')
    await step('After a relaunch the settings are as set')
  })
})
