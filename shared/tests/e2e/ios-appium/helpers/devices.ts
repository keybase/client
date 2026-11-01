// The phone's Devices screen (Settings > Devices): rows found by exact device name, a full read of
// the active devices it lists, and the app's own revoke (the device's page > Revoke this <kind> >
// Yes, delete it). The list is virtualized and the smoke account has hundreds of devices, so every
// read scrolls it with drags that stop before they lift (no fling skips rows) and reads one page
// source per screen.
import type {E2EEnv} from '../../accounts/env'
import {requireRevocableFromPhone, waitServiceRevoked} from '../../shared/devices.ts'
import * as T from '../../shared/test-ids'
import {step} from '../gate/step'
import {deviceRowPredicate, deviceRowsIn, mergeRows, rowDevice, showsRevokedDivider} from '../gate/devices-lib'
import {el, labeled, maskingName} from './elements'
import {escapeToTabs, navigateToMore, tapSettingsRow} from './navigate'

// A device the helpers find by its exact name. A paper key's name is the first two words of its
// phrase, so it never goes into an error: it is passed with the label errors use instead, and any
// error from under the helper (a selector naming it) has it replaced by that label.
export type NamedDevice = string | {name: string; label: string}

const named = (d: NamedDevice) => (typeof d === 'string' ? {label: d, name: d} : d)

const masking = async <T,>(d: NamedDevice, f: (name: string, label: string) => Promise<T>): Promise<T> => {
  const {label, name} = named(d)
  return maskingName(name, label, async () => f(name, label))
}

const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Moves the list's content up by (from - to) of the window's height (down when negative).
const dragList = async (from: number, to: number) => {
  const {width, height} = await browser.getWindowRect()
  const x = Math.round(width / 2)
  await browser
    .action('pointer')
    .move({x, y: Math.round(height * from)})
    .down()
    .move({duration: 500, x, y: Math.round(height * to)})
    .pause(300)
    .up()
    .perform()
  await sleep(300)
}

const rowsNow = async () => {
  const source = await browser.getPageSource()
  return {divider: showsRevokedDivider(source), rows: deviceRowsIn(source)}
}

// Settings > Devices, once the list has loaded rows; the list starts at its top. From wherever the
// app is: Devices is pushed above the tab bar, which hides the More tab, so it starts at the tabs.
export const openDevices = async () => {
  await escapeToTabs()
  await navigateToMore()
  await tapSettingsRow('Devices')
  await el(T.DEVICES_LIST).waitForExist({timeout: 15_000})
  await el(T.DEVICES_ROW).waitForExist({timeout: 30_000, timeoutMsg: 'the devices list loaded no rows within 30s'})
}

// A drag that showed no new row may have landed before the list rendered its next batch.
const STALL_READS = 3

// Every active device the list shows, top to bottom, read from its top (openDevices) down to the
// "Revoked devices" divider that ends them. Relies on that divider: the list shows it after the
// active devices whenever there are any, which there always are (the phone's).
// `shown` is how an error names a device (devices-lib paperKeyMasked).
export const listedActiveDevices = async (shown: (name: string) => string = n => n, timeoutMs = 240_000) => {
  const until = Date.now() + timeoutMs
  const current = new Set<string>()
  let names: Array<string> = []
  let stalled = 0
  for (let screens = 1; ; screens++) {
    const {divider, rows} = await rowsNow()
    const page = rows.flatMap(r => {
      const d = rowDevice(r.label)
      if (d?.current) current.add(d.name)
      return d?.active ? [d.name] : []
    })
    const merged = mergeRows(names, page, shown)
    const grew = merged.length > names.length
    names = merged
    // the virtualized list renders a contiguous run of rows, so a screen that reaches the divider holds the rest
    if (divider) return {current: [...current], names, screens}
    stalled = grew || screens === 1 ? 0 : stalled + 1
    if (stalled >= STALL_READS) {
      throw new Error(`the devices list stopped scrolling after ${names.length} active rows, before the revoked devices`)
    }
    if (Date.now() > until) throw new Error(`reading the devices list took over ${timeoutMs / 1000}s (${names.length} active rows so far)`)
    await dragList(0.85, 0.25)
  }
}

// Devices > Add a device or paper key: the add-a-device chooser.
export const openAddDevice = async () => {
  await openDevices()
  await labeled('Other', 'Add a device or paper key').click()
  await el(T.DEVICES_ADD_DEVICE).waitForExist({timeout: 15_000})
}

// Scrolls down from where the list is until the row of the device named exactly `name` sits on
// screen clear of the header, and returns it with its label.
export const findDeviceRow = async (device: NamedDevice, timeoutMs = 240_000) =>
  masking(device, async (name, label) => {
    // the list's own header, the Add button, sits above its rows and does not scroll; it is drawn a
    // moment after a screen over the list (the paper key's) closes
    const add = labeled('Other', 'Add a device or paper key')
    await add.waitForDisplayed({timeout: 10_000})
    const until = Date.now() + timeoutMs
    const {height} = await browser.getWindowRect()
    const listTop = (await add.getLocation('y')) + (await add.getSize('height'))
    // clear of the home indicator's safe area at the bottom
    const listBottom = height * 0.9
    let lastSeen: string | undefined
    let draggedFromY: number | undefined
    let unmovedDrags = 0
    let stalled = 0
    for (let screens = 1; ; screens++) {
      const {rows} = await rowsNow()
      const hits = rows.filter(r => rowDevice(r.label)?.name === name)
      if (hits.length > 1) throw new Error(`${hits.length} rows of the devices list carry the name of ${label}`)
      const hit = hits[0]
      if (hit?.visible && hit.y > height * 0.25 && hit.y < height * 0.65) return {label: hit.label, row: browser.$(deviceRowPredicate(name))}
      // A row near either end of the list can never reach that band: the first rows sit above it when
      // the list is at its top, the last rows below it when the list is at its end. Two drags in a row
      // that left the row where it was, below the list's header and above the bottom safe area, mean
      // the list is at that end and the row is on screen (one unmoved read could be a swallowed drag
      // over a row hidden under the header).
      unmovedDrags = hit?.visible && hit.y === draggedFromY && hit.y >= listTop && hit.y <= listBottom ? unmovedDrags + 1 : 0
      if (hit && unmovedDrags >= 2) return {label: hit.label, row: browser.$(deviceRowPredicate(name))}
      if (Date.now() > until) throw new Error(`finding ${label} in the devices list took over ${timeoutMs / 1000}s`)
      if (hit) {
        // on the page but under the header or low on the screen: bring it to the middle
        draggedFromY = hit.y
        await (hit.y >= height * 0.65 ? dragList(0.7, 0.45) : dragList(0.35, 0.6))
        continue
      }
      draggedFromY = undefined
      const last = rows.at(-1)?.label
      stalled = screens > 1 && last === lastSeen ? stalled + 1 : 0
      if (stalled >= STALL_READS) throw new Error(`no row for ${label} anywhere below in the devices list`)
      lastSeen = last
      await dragList(0.85, 0.25)
    }
  })

// Taps `name`'s row and waits for its device page, which must name it.
export const openDevicePage = async (device: NamedDevice) =>
  masking(device, async (name, label) => {
    const {row} = await findDeviceRow(device)
    await row.click()
    await el(T.DEVICE_PAGE).waitForExist({timeout: 15_000})
    await labeled('StaticText', name).waitForExist({
      timeout: 10_000,
      timeoutMsg: `the device page does not name ${label}`,
    })
  })

// From `name`'s open device page: Revoke this <kind>, the confirm screen naming it, `beforeConfirm`
// (a step), Yes, delete it. Sends revoke.revokeDevice; ends once the app has gone back to the list
// by itself. Bound (s): the confirm 15, its text 10, the step 5, the confirm closing 30, the device
// page gone 20, the list 15 = 95.
export const revokeOnPhone = async (device: NamedDevice, kind: 'computer' | 'paper key', beforeConfirm: () => Promise<void>) =>
  masking(device, async (name, label) => {
    await labeled('Button', `Revoke this ${kind}`).click()
    const confirm = labeled('Button', 'Yes, delete it')
    await confirm.waitForExist({timeout: 15_000})
    await labeled('StaticText', `Are you sure you want to revoke ${name}?`).waitForExist({
      timeout: 10_000,
      timeoutMsg: `the revoke confirm does not name ${label}`,
  })
  await beforeConfirm()
  await confirm.click()
  await confirm.waitForExist({reverse: true, timeout: 30_000, timeoutMsg: 'the revoke confirm stayed up for 30s'})
  await el(T.DEVICE_PAGE).waitForExist({reverse: true, timeout: 20_000, timeoutMsg: 'the app left the device page up after the revoke'})
  await el(T.DEVICES_LIST).waitForExist({timeout: 15_000, timeoutMsg: 'the app did not go back to the devices list'})
  })

// Waits until the list, where it is, no longer shows `name` as an active device.
export const waitNotListedActive = async (device: NamedDevice, timeoutMs = 30_000) =>
  masking(device, async (name, label) => {
    const until = Date.now() + timeoutMs
    for (;;) {
      const {rows} = await rowsNow()
      if (!rows.some(r => rowDevice(r.label)?.name === name && rowDevice(r.label)?.active)) return
      if (Date.now() > until) throw new Error(`the devices list still shows ${label} as active after ${timeoutMs / 1000}s`)
      await sleep(1_000)
    }
  })

const kindLabel = {computer: 'Computer', 'paper key': 'Paper key'} as const

// From the devices list: `device`'s page, which must say its kind, then `pageStep`; `beforeRevoke`
// (the flow's own checks); the phone's revoke guard; the app's revoke, its confirm a step; and the
// read-backs that the list and the service no longer have it active, then a step. Worst case (s):
// openDevicePage 275 (findDeviceRow 250, the page 25), its label 10, the guard 20, revokeOnPhone 95
// (its confirm's step among them), not listed active 30, revoked 30, two steps 10 = 470, plus
// `beforeRevoke`.
export const revokeFromDevicePage = async (
  env: E2EEnv,
  device: {deviceID: string; shown: NamedDevice},
  kind: 'computer' | 'paper key',
  phoneDeviceID: string,
  o: {beforeRevoke?: () => Promise<void> | void; pageStep: Parameters<typeof step>}
) => {
  const {deviceID, shown} = device
  await openDevicePage(shown)
  await labeled('StaticText', kindLabel[kind]).waitForExist({timeout: 10_000})
  await step(...o.pageStep)
  await o.beforeRevoke?.()
  await requireRevocableFromPhone(env, {deviceID, name: named(shown).name}, phoneDeviceID)
  // sends revoke.revokeDevice
  await revokeOnPhone(shown, kind, async () => step(`The revoke confirm names the ${kind}`))
  await waitNotListedActive(shown)
  await waitServiceRevoked(deviceID, `the ${kind}`)
  await step(`Back on the devices list, the ${kind} no longer active`)
}
