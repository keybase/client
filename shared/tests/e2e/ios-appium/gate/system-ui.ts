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
import {tapElement, tapFrame} from '../helpers/menus'
import {e2eRunId} from '../../shared/run-marker.ts'
import {deleteSavedAsset, libraryHasAsset, mediaPermission, requestFullPhotoAccess} from './app-ask.ts'
import {clearGatePoison, poisonGate} from './poison-lib.ts'
import {hasTrait, sourceElements} from './page-source-lib.ts'
import {WaitStopped} from './wait-lib.ts'
import {corpusCellOf, corpusCells, fileCellName, folderCellName, LIBRARY_GRID_ORDER, LIBRARY_PHOTO_ORDER, libraryCells, type LibraryName} from './picker-lib.ts'

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

// The buttons matching `selector` drawn in the row: a swipe draws a row's actions beside it at its
// height, so a button whose middle is within the row's top and bottom is that row's (its stack's,
// when iOS stacks them). Any other on screen (another app's group) is never one of them.
const buttonsInRow = async (selector: string, row: {y: number; height: number}) => {
  const inRow = []
  for (const b of await browser.$$(selector).getElements()) {
    const r = await browser.getElementRect(b.elementId)
    const mid = r.y + r.height / 2
    if (mid >= row.y && mid <= row.y + row.height) inRow.push(b)
  }
  return inRow
}

// A swiped notification offers "Clear"; a swiped stack of an app's notifications offers "Clear All"
// (with Options and View), which clears that app's stack.
const CLEAR_BUTTONS = '-ios predicate string:type == "XCUIElementTypeButton" AND (label == "Clear" OR label == "Clear All")'

// The one Clear button the swipe showed in the swiped row.
const clearInRow = async (row: {y: number; height: number}) => {
  const inRow = await buttonsInRow(CLEAR_BUTTONS, row)
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
    if (!clear) {
      // what the swipe did show beside the row (system buttons' own labels), for whoever reads the failure
      const labels = []
      for (const el of await buttonsInRow('-ios predicate string:type == "XCUIElementTypeButton"', row)) labels.push(await el.getAttribute('label'))
      throw new Error(`Notification Center showed no Clear for one of this run's notifications (buttons in its row: ${labels.join(', ') || 'none'})`)
    }
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

// Waits for the photo picker the app opened to draw the corpus, and returns its cells in `order`
// (picker-lib.ts corpusCells). A picker that opened with cells already selected is refused. Bound:
// the picker 20, the grid 20 overrun by one read 2 = 42.
const corpusInPicker = async (order: ReadonlyArray<LibraryName>) => {
  await button(PHOTO_PICKER).waitForExist({timeout: PICKER_OPEN_MS, timeoutMsg: 'the photo picker did not open'})
  return waitFor(
    'the corpus in the photo picker',
    async () => {
      const cells = await libraryNow()
      if (cells.some(c => c.selected)) throw new WaitStopped('the photo picker opened with cells already selected')
      return corpusCells(cells, order)
    },
    {interval: 1_000, timeout: 20_000}
  )
}

// In the photo picker the app opened, selects the corpus items `names` (each once, in that order:
// the app gets them in the order selected) and confirms. The corpus's cells are found by their
// dates and kinds (picker-lib.ts corpusCells), each tapped at its own frame (the grid reads
// visible=false), and the selection read back off the grid before the confirm. The caller proves
// the pick by the files the app was handed (device.ts pickedFiles). Bound: corpusInPicker 42, per
// item the tap 1, the selection read once 2, the confirm 5 and its tap 1, gone 15 = 65 + 1 per item.
export const pickFromLibrary = async (names: ReadonlyArray<LibraryName>) => {
  if (!names.length || new Set(names).size !== names.length) throw new Error('pick each corpus item once')
  const run = await corpusInPicker(LIBRARY_GRID_ORDER)
  for (const name of names) await tapFrame(corpusCellOf(run, name).rect, 'a corpus cell in the photo picker')
  const want = names.map(n => corpusCellOf(run, n).rect)
  const selected = (await libraryNow()).filter(c => c.selected)
  const same = (a: {x: number; y: number}, b: {x: number; y: number}) => a.x === b.x && a.y === b.y
  if (selected.length !== want.length || !want.every(r => selected.some(c => same(c.rect, r)))) {
    throw new Error(`the photo picker reads ${selected.length} cells selected, not the ${want.length} tapped`)
  }
  await button(PHOTO_ADD).waitForExist({timeout: 5_000, timeoutMsg: "the photo picker's confirm did not show"})
  await button(PHOTO_ADD).click()
  await waitPickerGone('the photo picker', photoPickerUp)
}

// In a photos-only, single-pick photo picker the app opened (an avatar's, an emoji's), taps the
// corpus photo `name`: such a picker hands the photo over on the tap, with no confirm, so nothing can
// be read back before it goes. The corpus's photos are found as in pickFromLibrary (in
// LIBRARY_PHOTO_ORDER) and the cell is tapped at its frame; the caller proves the pick by the file
// the app was handed. Bound: corpusInPicker 42, the tap 1, gone 15 = 58.
export const pickOnePhoto = async (name: LibraryName) => {
  const run = await corpusInPicker(LIBRARY_PHOTO_ORDER)
  await tapFrame(corpusCellOf(run, name, LIBRARY_PHOTO_ORDER).rect, 'a corpus cell in the photo picker')
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
// overrun by one try's reads and tap 2, the folder's tap 1 and its screen 10, the file 10 and its
// tap 1, its selection 5, Open 5 and its tap 1, gone 15 = 100.
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
    async () => (hasTrait(await cell.getAttribute('traits'), 'Selected') ? true : undefined),
    {interval: 250, timeout: 5_000}
  )
  await button('Open').waitForExist({timeout: 5_000, timeoutMsg: "the document picker's Open did not show"})
  await button('Open').click()
  await waitPickerGone('the document picker', documentPickerUp)
}

// For a flow's afterEach: closes a photo or document picker a test left up (escapeToTabs can't: the
// document picker with a file selected has no Cancel, and the app's own back does nothing under
// either). A picker that won't close leaves every later test under it, so a failure poisons the gate;
// one closed clears it. Bound, for both pickers should both be up: the reads 2, then each picker's
// Cancel 5 and its tap 1 (and a deselect 1) and gone 15 = 45.
export const closeSystemPickers = async () => {
  try {
    if (await photoPickerUp()) {
      await button('Cancel').waitForExist({timeout: 5_000})
      await button('Cancel').click()
      await waitPickerGone('the photo picker', photoPickerUp)
    }
    if (await documentPickerUp()) {
      const deselect = button('Deselect All')
      if (await deselect.isExisting()) await deselect.click()
      await button('Cancel').waitForExist({timeout: 5_000})
      await button('Cancel').click()
      await waitPickerGone('the document picker', documentPickerUp)
    }
  } catch (e) {
    poisonGate(SYSTEM_PICKERS, 'close the photo or document picker left over the app on the simulator')
    throw new Error(`closing a system picker failed: ${e instanceof Error ? e.message : String(e)}`, {cause: e})
  }
  clearGatePoison(SYSTEM_PICKERS)
}

// -- the photo library's system alerts -----------------------------------------------------------

// XCUITest's answer when no system alert is up
const NO_ALERT = /no such alert|modal dialog when one was not open/i

// The system alert's text, or undefined when none is up. Bound: one read 1.
const alertText = async () => {
  try {
    return await browser.getAlertText()
  } catch (e) {
    if (e instanceof Error && NO_ALERT.test(e.message)) return undefined
    throw e
  }
}

// An alert's button tapped while the alert still slides in does nothing (seen live: the tap
// answered, the alert stayed up, and the ask it holds never answered), so a tap waits this long
// after the alert is first read.
const ALERT_SETTLE_MS = 1_000

// Taps `button` on the system alert once one is up whose text `matches`, and waits for the alert to
// go, tapping again only while that same alert is still up; an alert of any other text is never
// tapped (it fails). It stops with no alert up once `asked()` (the ask the alert answers has settled,
// so none is coming). Bound: `timeout` (its reads 1 each, the taps 1 each).
const acceptAlert = async (what: string, matches: (text: string) => boolean, button: string, asked: () => boolean, timeout = 20_000) => {
  let seenAt: number | undefined
  let tapped = false
  await waitFor(
    what,
    async () => {
      const text = await alertText()
      if (text === undefined) return tapped || asked() ? true : undefined
      if (!matches(text)) throw new WaitStopped(`${what}: another system alert is up`)
      seenAt ??= Date.now()
      if (Date.now() - seenAt < ALERT_SETTLE_MS) return undefined
      await browser.execute('mobile: alert', {action: 'accept', buttonLabel: button})
      tapped = true
      return undefined
    },
    {interval: 500, timeout}
  )
}

// Runs an ask of the app that waits on a system alert alongside the tap that answers it (`tap`, told
// when the ask has settled), and waits for both, so neither is still running when this fails. The
// ask's failure is the one thrown: the tap's (no alert came) follows from it.
const withAlert = async <R,>(ask: Promise<R>, tap: (asked: () => boolean) => Promise<void>): Promise<R> => {
  let settled = false
  const asking = ask.finally(() => {
    settled = true
  })
  const [got, tapped] = await Promise.allSettled([asking, tap(() => settled)])
  if (got.status === 'rejected') throw got.reason
  if (tapped.status === 'rejected') throw tapped.reason
  return got.value
}

// Full photo access for the app, for a flow's read-back of what it saved and its delete by exact id:
// a simctl photos grant is not what PhotoKit reads (live: the app reads it undetermined, and the
// library reads empty), so the app asks iOS and this taps Allow Full Access. Access the app already
// reads as full shows no prompt, so it is read first. Taken after the flow's grantPrivacy('photos-add')
// and grantPrivacy('photos'), whose restores put it back (iOS then holds Photos in place of
// PhotosAdd). Credits nothing. Bound: the read 25, the ask 35 (30 and its pause and resume; the
// alert's 20 inside it) = 60.
export const grantFullPhotoAccess = async () => {
  const now = await mediaPermission()
  if (now.read === 'granted' && now.readAccess === 'all') return
  const got = await withAlert(requestFullPhotoAccess(), async asked =>
    acceptAlert('the full photo access prompt', t => t.includes('access to your Photo Library'), 'Allow Full Access', asked)
  )
  if (!got.granted || got.readAccess !== 'all') throw new Error(`the app reads photo access ${got.readAccess}, not all, after Allow Full Access`)
}

// Deletes the photo the test saved, by its exact id (deleteSavedAsset refuses an id in `before`, the
// library's ids before the test saved), tapping Delete on iOS's confirm, and reads back that the
// library no longer holds it (iOS keeps it in Recently Deleted for 30 days, out of the library a
// query reads). Bound: the delete 35 (the ask 30 and its pause and resume; the alert's 20 inside
// it), the read 25 = 60.
export const deleteSavedPhoto = async (id: string, before: ReadonlySet<string>) => {
  await withAlert(deleteSavedAsset(id, before), async asked =>
    acceptAlert('the photo delete confirm', t => t.startsWith('Allow “Keybase” to delete this photo?'), 'Delete', asked)
  )
  if (await libraryHasAsset(id)) throw new Error('the photo library still holds the saved photo after its delete')
}

// Whether a system alert (a permission prompt, a confirm) is up over the app. Bound: one read 1.
export const systemAlertUp = async () => (await alertText()) !== undefined
