// The phone's Devices screen (Settings > Devices): rows found by exact device name, a full read of
// the active devices it lists, and the app's own revoke (the device's page > Revoke this <kind> >
// Yes, delete it). The list is virtualized and the smoke account has hundreds of devices, so every
// read scrolls it with drags that stop before they lift (no fling skips rows) and reads one page
// source per screen.
import * as T from '../../shared/test-ids'
import {deviceRowPredicate, deviceRowsIn, mergeRows, rowDevice, showsRevokedDivider} from '../gate/devices-lib'
import {el} from './elements'
import {navigateToMore, tapSettingsRow} from './navigate'

// The element of `type` whose label is exactly `label`.
export const labeled = (type: 'Button' | 'Other' | 'StaticText', label: string) =>
  browser.$(`-ios predicate string:type == "XCUIElementType${type}" AND label == "${label.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)

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

// Settings > Devices, once the list has loaded rows; the list starts at its top.
export const openDevices = async () => {
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
export const listedActiveDevices = async (timeoutMs = 240_000) => {
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
    const merged = mergeRows(names, page)
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

// Scrolls down from where the list is until the row of the device named exactly `name` sits on
// screen clear of the header and the tab bar, and returns it with its label.
export const findDeviceRow = async (name: string, timeoutMs = 240_000) => {
  const until = Date.now() + timeoutMs
  const {height} = await browser.getWindowRect()
  let lastSeen: string | undefined
  let pulledFromY: number | undefined
  let stalled = 0
  for (let screens = 1; ; screens++) {
    const {rows} = await rowsNow()
    const hits = rows.filter(r => rowDevice(r.label)?.name === name)
    if (hits.length > 1) throw new Error(`${hits.length} rows of the devices list carry the name ${name}`)
    const hit = hits[0]
    if (hit?.visible && hit.y > height * 0.25 && hit.y < height * 0.65) return {label: hit.label, row: browser.$(deviceRowPredicate(name))}
    // the list's first rows sit above that band when it is at its top: a pull down that left the
    // row where it was means the list is at its top, the row just under its own header
    if (hit?.visible && hit.y === pulledFromY) return {label: hit.label, row: browser.$(deviceRowPredicate(name))}
    if (Date.now() > until) throw new Error(`finding ${name} in the devices list took over ${timeoutMs / 1000}s`)
    if (hit) {
      // on the page but under the header or near the tab bar: bring it to the middle
      const low = hit.y >= height * 0.65
      pulledFromY = low ? undefined : hit.y
      await (low ? dragList(0.7, 0.45) : dragList(0.35, 0.6))
      continue
    }
    pulledFromY = undefined
    const last = rows.at(-1)?.label
    stalled = screens > 1 && last === lastSeen ? stalled + 1 : 0
    if (stalled >= STALL_READS) throw new Error(`no row for ${name} anywhere below in the devices list`)
    lastSeen = last
    await dragList(0.85, 0.25)
  }
}

// Taps `name`'s row and waits for its device page, which must name it.
export const openDevicePage = async (name: string) => {
  const {row} = await findDeviceRow(name)
  await row.click()
  await el(T.DEVICE_PAGE).waitForExist({timeout: 15_000})
  await labeled('StaticText', name).waitForExist({
    timeout: 10_000,
    timeoutMsg: `the device page does not name ${name}`,
  })
}

// From `name`'s open device page: Revoke this <kind>, the confirm screen naming it, `beforeConfirm`
// (a step), Yes, delete it. Sends revoke.revokeDevice; ends once the app is back on the list.
export const revokeOnPhone = async (name: string, kind: 'computer' | 'paper key', beforeConfirm: () => Promise<void>) => {
  await labeled('Button', `Revoke this ${kind}`).click()
  const confirm = labeled('Button', 'Yes, delete it')
  await confirm.waitForExist({timeout: 15_000})
  await labeled('StaticText', `Are you sure you want to revoke ${name}?`).waitForExist({
    timeout: 10_000,
    timeoutMsg: `the revoke confirm does not name ${name}`,
  })
  await beforeConfirm()
  await confirm.click()
  await confirm.waitForExist({reverse: true, timeout: 30_000, timeoutMsg: 'the revoke confirm stayed up for 30s'})
  await el(T.DEVICE_PAGE).waitForExist({reverse: true, timeout: 15_000, timeoutMsg: 'the app did not go back to the devices list'})
}

// Waits until the list, where it is, no longer shows `name` as an active device.
export const waitNotListedActive = async (name: string, timeoutMs = 30_000) => {
  const until = Date.now() + timeoutMs
  for (;;) {
    const {rows} = await rowsNow()
    if (!rows.some(r => rowDevice(r.label)?.name === name && rowDevice(r.label)?.active)) return
    if (Date.now() > until) throw new Error(`the devices list still shows ${name} as active after ${timeoutMs / 1000}s`)
    await sleep(1_000)
  }
}
