// The phone's system UI around the app: notification banners, Notification Center, the home
// screen and the system photo and document pickers. Like device.ts these credit nothing: a flow
// credits 'push-notification' once it has asserted what the app did with the notification, and
// 'photo-picker' / 'file-picker' once it has read back what the app was handed. Every find has a deadline and answers a bounded
// result; errors are thrown, never read as "not shown".
import {
  appSnapshot,
  closeNotificationCenter,
  lookFor,
  openNotificationCenter,
  shownWithLabel,
  waitFor,
  withSpringboard,
} from '../helpers/lifecycle'
import {tapElement, tapFrame} from '../helpers/files'
import {e2eRunId} from '../../shared/run-marker.ts'
import {clearGatePoison, poisonGate} from './poison-lib.ts'
import {sourceElements} from './page-source-lib.ts'
import {corpusCellOf, corpusCells, fileCellName, folderCellName, libraryCells, type LibraryName} from './picker-lib.ts'

const BANNER_MS = 8_000
// clearing a few of this run's notifications, one swipe and tap each
const CLEAR_MS = 30_000
const CLOSED_MS = 10_000
const NOTIFICATION_CENTER = 'Notification Center'

// A notification body goes into an XCUITest predicate: only a stamped marker's characters.
const requirePlain = (text: string) => {
  if (!/^[A-Za-z0-9_.-]{1,120}$/.test(text)) throw new Error('refusing a notification text that is not a stamped marker')
  return text
}

// The banner showing `body` (its button, which takes the tap), or undefined when none shows within
// `timeout`.
export const findBanner = async (body: string, timeout = BANNER_MS) => {
  const text = requirePlain(body)
  return withSpringboard(async () => shownWithLabel(text, timeout))
}

export const tapBanner = async (body: string, timeout = BANNER_MS) => {
  const text = requirePlain(body)
  await withSpringboard(async () => {
    const el = await shownWithLabel(text, timeout)
    if (!el) throw new Error(`no notification showed ${text} within ${timeout}ms`)
    await el.click()
  })
}

// Brings the home screen to the front: the app goes to the background as when the person leaves it.
export const springboardActivate = async () => browser.execute('mobile: activateApp', {bundleId: 'com.apple.springboard'})

const clearButtons = () => browser.$$('-ios predicate string:type == "XCUIElementTypeButton" AND label == "Clear"')

// The one Clear button the swipe showed in the swiped row: the row's actions sit beside it at its
// height, so a Clear whose middle is within the row's top and bottom is that row's (or its group's,
// when iOS stacks them). Any other Clear on screen (another app's group) is never tapped.
const clearInRow = async (row: {y: number; height: number}) => {
  const inRow = []
  for (const b of await clearButtons().getElements()) {
    const r = await browser.getElementRect(b.elementId)
    const mid = r.y + r.height / 2
    if (mid >= row.y && mid <= row.y + row.height) inRow.push(b)
  }
  if (inRow.length > 1) throw new Error(`the swiped notification showed ${inRow.length} Clear buttons in its row`)
  return inRow[0]
}

// Swipes each of this run's notifications (their bodies carry e2e-<runid>-push) aside and taps its
// row's Clear, until Notification Center shows none.
const clearRunNotifications = async () => {
  const stamp = `e2e-${e2eRunId()}-push`
  const end = Date.now() + CLEAR_MS
  for (;;) {
    const shown = await shownWithLabel(stamp, 0)
    if (!shown) return
    if (Date.now() > end) throw new Error(`Notification Center still shows this run's notifications after ${CLEAR_MS}ms of clearing`)
    const row = await browser.getElementRect(shown.elementId)
    await browser.execute('mobile: swipe', {direction: 'left', elementId: shown.elementId})
    const clear = await lookFor(async () => clearInRow(row), {timeout: 3_000})
    if (!clear) throw new Error(`Notification Center showed no Clear for one of this run's notifications`)
    await clear.click()
  }
}

// Opens Notification Center over the app, runs `fn` with a bounded find inside it, then clears this
// run's notifications and closes it. Notification Center left open (or this run's notifications left
// in it) leaves the app inactive for every later flow, so a clear or close that fails poisons the
// gate and throws; one that works clears that poison.
export const withNotificationCenter = async <R,>(fn: (find: (body: string) => ReturnType<typeof findBanner>) => Promise<R>): Promise<R> => {
  await openNotificationCenter()
  let out: R | undefined
  let failure: Error | undefined
  try {
    out = await withSpringboard(async () => fn(async body => shownWithLabel(requirePlain(body), BANNER_MS)))
  } catch (e) {
    failure = e instanceof Error ? e : new Error(String(e))
  }
  try {
    await withSpringboard(clearRunNotifications)
    await closeNotificationCenter()
    const active = await lookFor(async () => ((await appSnapshot()).mobileAppState === 'active' ? true : undefined), {interval: 500, timeout: CLOSED_MS})
    if (!active) throw new Error(`the app was not active again within ${CLOSED_MS}ms of closing Notification Center`)
  } catch (e) {
    poisonGate(NOTIFICATION_CENTER, "clear this run's notifications in the simulator's Notification Center and swipe it closed")
    const why = `putting back Notification Center failed: ${e instanceof Error ? e.message : String(e)}`
    throw failure ? new AggregateError([failure, e], `${failure.message}; and then ${why}`) : new Error(why, {cause: e})
  }
  clearGatePoison(NOTIFICATION_CENTER)
  if (failure) throw failure
  return out as R
}

// -- the system pickers ---------------------------------------------------------------------------

const PICKER_OPEN_MS = 20_000
const PICKER_GONE_MS = 15_000
const SYSTEM_PICKERS = 'a system picker'

const button = (name: string) => browser.$(`-ios predicate string:type == "XCUIElementTypeButton" AND name == "${name}"`)
// The photo picker is up while its Photos / Collections switch is; its confirm reads "Done" and is
// named Done with nothing selected, Add once something is. The document picker's tab bar.
const PHOTO_PICKER = 'Collections'
const PHOTO_ADD = 'Add'
const DOC_TABS = '-ios predicate string:name == "DOC.browsingModeTabBar"'
const photoPickerUp = async () => button(PHOTO_PICKER).isExisting()
const documentPickerUp = async () => browser.$(DOC_TABS).isExisting()

const waitPickerGone = async (what: string, up: () => Promise<boolean>) =>
  waitFor(`${what} to close`, async () => ((await up()) ? undefined : true), {interval: 500, timeout: PICKER_GONE_MS})

const libraryNow = async () => libraryCells(sourceElements(await browser.getPageSource()))

// In the photo picker the app opened, selects the corpus items `names` (each once, in that order:
// the app gets them in the order selected) and confirms. The corpus's cells are found by their
// dates and kinds (picker-lib.ts corpusCells), each tapped at its own frame (the grid reads
// visible=false), and the selection read back off the grid before the confirm. The caller proves
// the pick by the files the app was handed (device.ts pickedFiles). Bound: the picker 20, the grid
// read 20 (each read 2), per item the tap 1, the selection read 2, the confirm 1, gone 15.
export const pickFromLibrary = async (names: ReadonlyArray<LibraryName>) => {
  if (!names.length || new Set(names).size !== names.length) throw new Error('pick each corpus item once')
  await button(PHOTO_PICKER).waitForExist({timeout: PICKER_OPEN_MS, timeoutMsg: 'the photo picker did not open'})
  const run = await waitFor(
    'the corpus in the photo picker',
    async () => {
      const cells = await libraryNow()
      if (cells.some(c => c.selected)) throw new Error('the photo picker opened with cells already selected')
      return corpusCells(cells)
    },
    {interval: 1_000, timeout: 20_000}
  )
  for (const name of names) await tapFrame(corpusCellOf(run, name).rect, 'a corpus cell in the photo picker')
  const want = names.map(n => corpusCellOf(run, n).rect)
  const selected = (await libraryNow()).filter(c => c.selected)
  const same = (a: {x: number; y: number}, b: {x: number; y: number}) => a.x === b.x && a.y === b.y
  if (selected.length !== want.length || !want.every(r => selected.some(c => same(c.rect, r)))) {
    throw new Error(`the photo picker reads ${selected.length} cells selected, not the ${want.length} tapped`)
  }
  await button(PHOTO_ADD).click()
  await waitPickerGone('the photo picker', photoPickerUp)
}

const ON_MY_IPHONE = '-ios predicate string:type == "XCUIElementTypeCell" AND name == "DOC.sidebar.item.On My iPhone"'
const cellNamed = (name: string) => browser.$(`-ios predicate string:type == "XCUIElementTypeCell" AND name == "${name}"`)
const browsingRootTitled = (title: string) =>
  browser.$(`-ios predicate string:name == "DOC.browsingRoot Source: com.apple.FileProvider.LocalStorage, Title: ${title}"`)

// In the document picker the app opened, opens "On My iPhone" > `folder` (a seeded folder of this
// run, device.ts seedDocumentFolder), selects `file` and opens it. Browse lands on its sidebar or
// wherever it was left: until the folder's cell shows, its sidebar's On My iPhone is tapped, or else
// Browse again (which goes back to the sidebar). Bound: the picker 20, the way to the folder 30
// (each try's reads and tap 2), the folder 10, the file 10 and its tap 1, its selection 5, Open 1,
// gone 15.
export const pickDocument = async (folder: string, file: string) => {
  const folderCell = folderCellName(folder)
  const fileCell = fileCellName(file)
  await browser.$(DOC_TABS).waitForExist({timeout: PICKER_OPEN_MS, timeoutMsg: 'the document picker did not open'})
  await waitFor(
    "the seeded folder in the document picker's On My iPhone",
    async () => {
      if (await cellNamed(folderCell).isExisting()) return true
      const local = browser.$(ON_MY_IPHONE)
      if (await local.isExisting()) await local.click()
      else await button('Browse').click()
      return undefined
    },
    {interval: 1_000, timeout: 30_000}
  )
  await cellNamed(folderCell).click()
  await browsingRootTitled(folder).waitForExist({timeout: 10_000, timeoutMsg: 'the document picker did not open the seeded folder'})
  const cell = cellNamed(fileCell)
  await cell.waitForExist({timeout: 10_000, timeoutMsg: 'the seeded file is not in the folder'})
  await tapElement(await cell.getElement(), 'the seeded file')
  await waitFor(
    'the seeded file selected',
    async () => (((await cell.getAttribute('traits')) ?? '').split(', ').includes('Selected') ? true : undefined),
    {interval: 250, timeout: 5_000}
  )
  await button('Open').click()
  await waitPickerGone('the document picker', documentPickerUp)
}

// For a flow's afterEach: closes a photo or document picker a test left up (escapeToTabs can't: the
// document picker with a file selected has no Cancel, and the app's own back does nothing under
// either). A picker that won't close leaves every later test under it, so a failure poisons the gate;
// one closed clears it. Bound: the reads 2, a deselect 1, the cancel 1, gone 15.
export const closeSystemPickers = async () => {
  try {
    if (await photoPickerUp()) {
      await button('Cancel').click()
      await waitPickerGone('the photo picker', photoPickerUp)
    }
    if (await documentPickerUp()) {
      const deselect = button('Deselect All')
      if (await deselect.isExisting()) await deselect.click()
      await button('Cancel').click()
      await waitPickerGone('the document picker', documentPickerUp)
    }
  } catch (e) {
    poisonGate(SYSTEM_PICKERS, 'close the photo or document picker left over the app on the simulator')
    throw new Error(`closing a system picker failed: ${e instanceof Error ? e.message : String(e)}`, {cause: e})
  }
  clearGatePoison(SYSTEM_PICKERS)
}
