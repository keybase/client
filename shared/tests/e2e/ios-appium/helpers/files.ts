// Helpers for the iOS Files flows: the screen the app shows, a folder opened from the Files tab a
// row at a time, a row found by its exact name (scrolling the list for it), and a row's or the
// folder's own "..." menu. Names are compared in memory, so a file, folder or account name never
// goes into a selector or an error.
//
// A row's label merges its texts with ", ", and the app draws a name's extension (a dot within its
// last ten characters) as a text of its own: a name a flow finds by its row has no such dot.
//
// On a folder screen inside a folder (the smoke account's, a work folder) XCUITest reports every
// element visible=false, the header's buttons too, and an element click there taps nothing; the Files
// root and the folder type screens report them visible. So rows and the controls on a folder screen
// are found without `visible`, kept to the frame of the one files browser in the tree (the app keeps
// no other screen's rows there), and tapped at their own frames (tapFrame).
import type {ChainablePromiseElement} from 'webdriverio'
import * as T from '../../shared/test-ids'
import {elementInRow, innermost, type Rect} from '../gate/chat-lib.ts'
import {retriedNavigation} from '../gate/step.ts'
import {focusedFieldText, focusSecretField} from '../gate/secret-input.ts'
import {signedInAs, typeIntoFocused} from './chat'
import {check, labelledElement, openMenuFrom} from './menus'
import {appSnapshot, waitFor} from './lifecycle'
import {escapeToTabs, goBack, tabTo} from './navigate'

export const BUTTONS = '-ios predicate string:type == "XCUIElementTypeButton" AND visible == 1'

export type Screen = {name?: string; params?: Record<string, unknown>}

// The screen the app shows. Bound: one read 1.
export const visibleScreen = async (): Promise<Screen | undefined> => (await appSnapshot()).screen

// Waits for the screen up to be `name` with params `ok` takes. Bound: `timeout`, plus one read 1.
export const expectScreen = async (
  what: string,
  name: string,
  ok: (params: Record<string, unknown>) => boolean = () => true,
  timeout = 10_000
) =>
  waitFor(
    what,
    async () => {
      const s = await visibleScreen()
      return s?.name === name && ok(s.params ?? {}) ? s : undefined
    },
    {interval: 250, timeout}
  )

// The folder screen of `path`. Bound: 10s, plus one read 1.
export const expectFolder = async (what: string, path: string) => expectScreen(what, 'fsBrowse', p => p['path'] === path)

const rectOf = async (e: WebdriverIO.Element): Promise<Rect | undefined> => {
  const at = await e.getLocation().catch(() => undefined)
  const size = await e.getSize().catch(() => undefined)
  return at && size ? {...at, ...size} : undefined
}

const inside = (r: Rect, area: Rect) =>
  r.width > 0 && r.height > 0 && r.x >= area.x && r.y >= area.y && r.x + r.width <= area.x + area.width && r.y + r.height <= area.y + area.height

// Taps the middle of `rect`, only when it lies wholly on screen. Bound: the window read and the tap 1.
export const tapFrame = async (rect: Rect, what: string) => {
  const {height, width} = await browser.getWindowRect()
  check(inside(rect, {height, width, x: 0, y: 0}), `${what} is not wholly on screen: not tapping`)
  await browser.execute('mobile: tap', {x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2)})
}

// Taps `e` at its own frame. Bound: its frame read and the tap 1.
export const tapElement = async (e: WebdriverIO.Element, what: string) => {
  const rect = await rectOf(e)
  if (!rect) throw new Error(`${what} has no position`)
  await tapFrame(rect, what)
}

// Where rows are drawn: `within`'s frame, else the files browser's, else the window. Bound: 1.
const rowArea = async (within?: WebdriverIO.Element): Promise<Rect> => {
  const browserEl = within ?? (await browser.$$(`~${T.FILES_BROWSER}`).getElements())[0]
  const rect = browserEl ? await rectOf(browserEl) : undefined
  if (rect) return rect
  const {height, width} = await browser.getWindowRect()
  return {height, width, x: 0, y: 0}
}

// The Files rows go by their frame in the browser; any other list's rows (a team's members) by
// `visible`, as XCUITest reports those.
const isFilesRow = (testID: string) => testID === T.FILES_ROW || testID === T.FILES_TLF_ROW

const labelParts = (label: string) =>
  label
    .replace(/\u00a0/g, ' ')
    .split(', ')
    .map(p => p.trim())

export type DrawnRow = {e: WebdriverIO.Element; rect: Rect}

// The element with `testID` drawn (a Files row: wholly inside the list, rowArea) whose label holds `name` as a part
// (the innermost of nested matches), under `within` when given, or undefined when none is; and what
// every such element reads, to tell a drag that moved the list from one that did not. Throws when more
// than one matches.
const drawnNamed = async (testID: string, name: string, within?: WebdriverIO.Element) => {
  const root = within ?? browser
  const files = isFilesRow(testID)
  const area = files ? await rowArea(within) : undefined
  const found: Array<DrawnRow> = []
  const labels: Array<string> = []
  const visible = files ? '' : ' AND visible == 1'
  for (const e of await root.$$(`-ios predicate string:name == ${JSON.stringify(testID)}${visible}`).getElements()) {
    const label = (await e.getAttribute('label').catch(() => null)) ?? ''
    labels.push(label)
    if (!labelParts(label).includes(name)) continue
    const rect = await rectOf(e)
    if (rect && (!area || inside(rect, area))) found.push({e, rect})
  }
  const inner = innermost(found.map(f => f.rect))
  if (inner.length > 1) throw new Error(`${inner.length} rows of the one name drawn, not one`)
  return {row: inner.length ? found[inner[0]!] : undefined, signature: labels.join('\n')}
}

export const drag = async (fromY: number, toY: number) => {
  const {width} = await browser.getWindowRect()
  const x = Math.round(width / 2)
  await browser
    .action('pointer', {parameters: {pointerType: 'touch'}})
    .move({x, y: Math.round(fromY)})
    .down()
    .move({duration: 300, x, y: Math.round(toY)})
    .pause(200)
    .up()
    .perform()
}

// The row (`testID`, FILES_ROW by default) named exactly `name`, under `within` when given. The list
// is dragged toward its end until the row shows, and back toward its start once a drag moves nothing,
// so a row anywhere in it, or one that arrives late, is found. Bound: `timeout`, plus one drag's 1.
export const filesRowNamed = async (
  name: string,
  what: string,
  {testID = T.FILES_ROW, timeout = 30_000, within}: {testID?: string; timeout?: number; within?: WebdriverIO.Element} = {}
): Promise<DrawnRow> => {
  let towardEnd = true
  let before: string | undefined
  return waitFor(
    what,
    async () => {
      const {row, signature} = await drawnNamed(testID, name, within)
      if (row) return row
      // a drag that changed nothing reached the list's end (or the list fits): turn around
      if (signature === before) towardEnd = !towardEnd
      before = signature
      const {height} = await browser.getWindowRect()
      await (towardEnd ? drag(height * 0.7, height * 0.35) : drag(height * 0.35, height * 0.7))
      return undefined
    },
    {interval: 300, timeout}
  )
}

// The Files tab's root (/keybase), from wherever the app is. Bound: escapeToTabs 30, tabTo 15 (three
// taps and 4s waits), the screen 11 = 56.
export const openFilesRoot = async () => {
  await escapeToTabs()
  await tabTo('Files', T.FILES_TLF_ROW)
  await expectScreen("the Files tab's root", 'fsRoot')
}

// Back from a folder to the Files tab's root (on a phone a folder is pushed above the tab bar, so
// back is the way out). Bound: 30s of tries, overrun by one (the back 3, the screen 5 and its read 1) = 39.
export const backToFilesRoot = async () =>
  retriedNavigation(
    "back to the Files tab's root",
    async () => {
      if ((await visibleScreen())?.name !== 'fsRoot') await goBack()
      await expectScreen("the Files tab's root", 'fsRoot', () => true, 5_000)
    },
    {intervals: [500], timeout: 30_000}
  )

// Opens the folder `path` (under /keybase/private, public or team) from the Files tab's root, tapping
// each row on the way by its exact name, and checks each screen is the folder it should be. Bound:
// root 56, the folder type's row 31, its tap 1 and screen 11 = 99, then per level below it the row
// (`rowTimeout`, one drag 1), the tap 1 and the screen 11.
export const openFolder = async (path: string, rowTimeout = 30_000) => {
  const parts = path.split('/')
  if (parts[0] !== '' || parts[1] !== 'keybase' || parts.length < 3) throw new Error('refusing a folder path outside /keybase')
  await openFilesRoot()
  let at = '/keybase'
  for (const [i, part] of parts.slice(2).entries()) {
    at = `${at}/${part}`
    const row =
      i === 0
        ? await filesRowNamed(part, 'the folder type row', {testID: T.FILES_TLF_ROW})
        : await filesRowNamed(part, 'the next folder row on the way', {timeout: rowTimeout})
    await tapFrame(row.rect, 'the folder row')
    await expectFolder('the folder tapped to open', at)
  }
}

// Opens the menu sheet of the row named `name` from its own "..." button. Bound: the row 31, the
// button in it 2, openMenuFrom 15 overrun by one try (the tap 1, the sheet 3) = 52.
export const openRowMenu = async (name: string, what: string) => {
  const row = await filesRowNamed(name, what)
  const button = await elementInRow(row.rect, T.FILES_ROW_MENU)
  await openMenuFrom(`the menu of ${what}`, async () => tapElement(button, `the menu button of ${what}`))
}

const sameRect = (a: Rect, b: Rect) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height

// Opens the folder screen's own "..." sheet: the header's More pill opens a native menu (Filter,
// Upload, More), and its More item opens the sheet. Bound: the pill 1, openMenuFrom 15 overrun by one
// try (the pill tap 1, the menu 5, its items read 2 and tapped 1, the sheet 3) = 28.
export const openFolderMoreSheet = async () => {
  // the header's own More, in the folder screen's navigation bar (see the top of this file for why
  // not `visible`)
  const pills: Array<Rect> = []
  for (const e of await browser
    .$$('-ios class chain:**/XCUIElementTypeNavigationBar[`name == "fsBrowse"`]/XCUIElementTypeButton[`label == "More"`]')
    .getElements()) {
    const rect = await rectOf(e)
    if (rect) pills.push(rect)
  }
  if (pills.length !== 1) throw new Error(`${pills.length} More buttons in the folder's header, not one`)
  const pillRect = pills[0]!
  // the menu's items report visible=false too
  const filter = browser.$('-ios predicate string:type == "XCUIElementTypeButton" AND label == "Filter"')
  await openMenuFrom("the folder's More sheet", async () => {
    if (!(await filter.isExisting())) {
      await tapFrame(pillRect, "the header's More pill")
      await filter.waitForExist({timeout: 5_000})
    }
    // the menu's own More item, not the pill that opened it
    const items: Array<DrawnRow> = []
    for (const e of await browser.$$('-ios predicate string:type == "XCUIElementTypeButton" AND label == "More"').getElements()) {
      const rect = await rectOf(e)
      if (rect && !sameRect(rect, pillRect)) items.push({e, rect})
    }
    const inner = innermost(items.map(i => i.rect))
    if (inner.length !== 1) throw new Error(`${inner.length} More items in the header's menu, not one`)
    await tapFrame(items[inner[0]!]!.rect, "the menu's More")
  })
}

// Every button, whether XCUITest reports it visible or not.
const ANY_BUTTONS = '-ios predicate string:type == "XCUIElementTypeButton"'

// Taps the one button drawn labelled `label`, once it is drawn: one reported visible, else (on a
// screen that reports its elements visible=false, a files confirmation) the one in the tree. A click
// on a button takes either way. Bound: 5s, the tap 1.
export const tapButton = async (label: string, what: string) => {
  const button = await waitFor(
    what,
    async () => labelledElement(BUTTONS, label, what).catch(async () => labelledElement(ANY_BUTTONS, label, what)),
    {interval: 250, timeout: 5_000}
  )
  await button.click()
}

// Puts `text` in the field `field` and reads it back, so a field that changed what was typed (a
// capital, a correction) fails before anything is submitted. Bound: the field 10, the typing 15, the
// read 1 = 26.
export const fillField = async (field: () => ChainablePromiseElement, text: string, what: string) => {
  await field().waitForExist({timeout: 10_000})
  await field().setValue(text)
  const got = await field().getAttribute('value')
  if (got !== text) throw new Error(`${what} does not read what was typed`)
}

// Puts `text` in the field `fieldTestID` that XCUITest cannot see (the editing row of a new folder or
// a rename is one accessible element, so its field is not in the tree): the field is focused through
// the app, what it holds deleted and `text` typed as key presses, then read back from the app. Bound:
// the focus 10 (its eval and 5 of reads), the read 1, the deletes 5, the typing 5, the read back 5 = 26.
export const fillHiddenField = async (fieldTestID: string, text: string, what: string) => {
  await focusSecretField(fieldTestID)
  const held = await focusedFieldText(fieldTestID)
  if (held.length) await typeIntoFocused(what, '\uE003'.repeat(held.length))
  await typeIntoFocused(what, text)
  await waitFor(`${what} to read what was typed`, async () => ((await focusedFieldText(fieldTestID)) === text ? true : undefined), {
    interval: 250,
    timeout: 5_000,
  })
}

// Waits for the relaunched app to be signed in and not switching accounts. Bound: 90s.
export const waitSignedIn = async () =>
  waitFor(
    'the relaunched app to sign in',
    async () => {
      const s = await signedInAs().catch(() => undefined)
      return s?.loggedIn && !s.switching ? true : undefined
    },
    {interval: 1_000, timeout: 90_000}
  )
