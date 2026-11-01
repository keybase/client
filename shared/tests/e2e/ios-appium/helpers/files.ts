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
import {elementInRow, innermost, inside, rectOf, type Rect} from '../gate/chat-lib.ts'
import {sourceElements} from '../gate/page-source-lib.ts'
import {isAttemptOver} from '../gate/attempt-binding-lib'
import {retriedNavigation} from '../gate/step.ts'
import {focusedFieldText, focusSecretField, setFieldText} from '../gate/secret-input.ts'
import {isKeyboardUp, signedInAs, typeIntoFocused} from './chat'
import {check, dragBetween, labelledElement, openMenuFrom} from './menus'
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

// Whether `e` is in the tree and its frame lies wholly on screen: what isDisplayed() would say if
// XCUITest's `visible` could be trusted (it reads false now and then on a team page, a modal or a
// sheet that is up). Bound: the reads 1.
export const onScreen = async (e: WebdriverIO.Element) => {
  const rect = await rectOf(e)
  if (!rect) return false
  const {height, width} = await browser.getWindowRect()
  return inside(rect, {height, width, x: 0, y: 0})
}

// onScreen for the one element with testID `id`; false when there is none. Bound: the reads 1.
export const onScreenID = async (id: string) => {
  const e = (await browser.$$(`~${id}`).getElements())[0]
  return e ? onScreen(e) : false
}

// Clicks `e` when XCUITest reports it visible, else taps it at its own frame: a screen's elements can
// read visible=false (a folder screen always, a team page or a modal now and then), and a click on
// such a box taps nothing. Bound: the reads 1, the tap 1.
export const press = async (e: WebdriverIO.Element, what: string) => {
  if ((await e.getAttribute('visible').catch(() => null)) === 'true') await e.click()
  else await tapElement(e, what)
}

// Presses the one element with testID `id` (press). Bound: its wait 10, the press 2.
export const pressTestID = async (id: string, what: string) => {
  await browser.$(`~${id}`).waitForExist({timeout: 10_000})
  const found = await browser.$$(`~${id}`).getElements()
  if (found.length !== 1) throw new Error(`${found.length} of ${what} in the tree, not one`)
  await press(found[0]!, what)
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
// `visible`, as XCUITest mostly reports those.
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
  const files = isFilesRow(testID)
  const area = files ? await rowArea(within) : undefined
  // another list's rows go by `visible`, unless XCUITest reports none of them visible (a modal it
  // reports invisible now and then): then every one in the tree
  const pick = <E,>(all: Array<E>, visible: (e: E) => boolean) => {
    const shown = files ? [] : all.filter(visible)
    return files || !shown.length ? all : shown
  }
  if (!within) {
    const {height, width} = await browser.getWindowRect()
    const screen = {height, width, x: 0, y: 0}
    // one page source, not a call per row and attribute (a list of a hundred teams took seconds a read)
    const all = sourceElements(await browser.getPageSource()).filter(e => e.attrs['name'] === testID)
    const candidates = pick(all, e => e.attrs['visible'] === 'true')
    // the named row is taken wherever it is drawn on screen, reported visible or not (a modal's row
    // can read invisible while its neighbours read visible); off screen it only says which way to drag
    const hits = all
      .filter(e => labelParts(e.attrs['label'] ?? '').includes(name))
      .map(e => ({height: Number(e.attrs['height']), width: Number(e.attrs['width']), x: Number(e.attrs['x']), y: Number(e.attrs['y'])}))
      .filter(r => inside(r, area ?? screen))
    const inner = innermost(hits)
    if (inner.length > 1) throw new Error(`${inner.length} rows of the one name drawn, not one`)
    const signature = candidates.map(e => e.attrs['label'] ?? '').join('\n')
    if (!inner.length) {
      // a list that is not virtualized keeps its off-screen rows in the tree: which way the row is
      const off = all.find(e => labelParts(e.attrs['label'] ?? '').includes(name))
      return {offscreen: off ? Number(off.attrs['y']) - height / 2 : undefined, row: undefined, signature}
    }
    const r = hits[inner[0]!]!
    const at = `rect.x == ${r.x} AND rect.y == ${r.y} AND rect.width == ${r.width} AND rect.height == ${r.height}`
    const e = (await browser.$$(`-ios predicate string:name == ${JSON.stringify(testID)} AND ${at}`).getElements()).at(-1)
    return {row: e ? {e, rect: r} : undefined, signature}
  }
  const found: Array<DrawnRow> = []
  const labels: Array<string> = []
  const byID = `-ios predicate string:name == ${JSON.stringify(testID)}`
  const shown = files ? [] : await within.$$(`${byID} AND visible == 1`).getElements()
  for (const e of files || !shown.length ? await within.$$(byID).getElements() : shown) {
    const label = (await e.getAttribute('label').catch(() => null)) ?? ''
    labels.push(label)
    if (!labelParts(label).includes(name)) continue
    const rect = await rectOf(e)
    if (rect && (!area || inside(rect, area))) found.push({e, rect})
  }
  const inner = innermost(found.map(f => f.rect))
  if (inner.length > 1) throw new Error(`${inner.length} rows of the one name drawn, not one`)
  return {offscreen: undefined as number | undefined, row: inner.length ? found[inner[0]!] : undefined, signature: labels.join('\n')}
}

// A drag down the screen's middle from `fromY` to `toY`.
export const drag = async (fromY: number, toY: number) => {
  const {width} = await browser.getWindowRect()
  await dragBetween({x: width / 2, y: fromY}, {x: width / 2, y: toY})
}

// The row (`testID`, FILES_ROW by default) named exactly `name`, under `within` when given. The list
// is dragged toward its end until the row shows, and back toward its start once a drag moves nothing,
// so a row anywhere in it, or one that arrives late, is found. Bound: `timeout`, plus one try's drag 1
// (a list other than Files drags twice a try and stops a second sooner, so the same), or 4 toward a
// row the tree holds off screen. A row found right after a drag is read again after an 0.8s settle
// (inside `timeout`).
export const filesRowNamed = async (
  name: string,
  what: string,
  {testID = T.FILES_ROW, timeout = 30_000, within}: {testID?: string; timeout?: number; within?: WebdriverIO.Element} = {}
): Promise<DrawnRow> => {
  let towardEnd = true
  let before: string | undefined
  let dragged = false
  return waitFor(
    what,
    async () => {
      const {offscreen, row, signature} = await drawnNamed(testID, name, within)
      if (row) {
        if (!dragged) return row
        // a list still gliding from a drag takes a tap as the stop of its glide: read the row again
        // once it has settled
        dragged = false
        await browser.pause(800)
        return undefined
      }
      dragged = true
      const {height} = await browser.getWindowRect()
      // a row the tree holds off screen (a list that is not virtualized) says which way and how far:
      // long drags toward it, up to four between reads
      if (offscreen !== undefined) {
        const span = height * 0.5
        for (let i = 0; i < Math.min(4, Math.ceil(Math.abs(offscreen) / span)); i++) {
          await (offscreen > 0 ? drag(height * 0.75, height * 0.25) : drag(height * 0.25, height * 0.75))
        }
        before = signature
        return undefined
      }
      // a drag that changed nothing reached the list's end (or the list fits): turn around
      if (signature === before) towardEnd = !towardEnd
      before = signature
      if (isFilesRow(testID)) await (towardEnd ? drag(height * 0.7, height * 0.35) : drag(height * 0.35, height * 0.7))
      else {
        // another list can run to a hundred rows (every team of the account): two long drags a read
        for (let i = 0; i < 2; i++) await (towardEnd ? drag(height * 0.8, height * 0.2) : drag(height * 0.2, height * 0.8))
      }
      return undefined
    },
    {interval: 300, timeout: isFilesRow(testID) ? timeout : timeout - 1_000}
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

// The one button labelled `label`: one reported visible, else (on a screen that reports its elements
// visible=false: a files confirmation, a modal stacked on a team page) the one in the tree. A click on
// a button takes either way. Bound: one read 1.
export const buttonLabelled = async (label: string, what: string) =>
  labelledElement(BUTTONS, label, what).catch(async () => labelledElement(ANY_BUTTONS, label, what))

// Clicks the button `button()` finds until `done()` says the click took: a click while the keyboard is
// up only closes the keyboard (and XCUITest reports the keyboard shown or not unreliably, so it is not
// closed first). A second click goes only if the first did not take, so nothing is submitted twice.
// Bound: two of (the find 1, the click 1, 3s of reads) = 10.
export const clickUntil = async (button: () => Promise<WebdriverIO.Element>, done: () => Promise<boolean>, what: string) => {
  for (let i = 0; i < 2; i++) {
    await (await button()).click()
    const took = await waitFor(what, async () => ((await done()) ? true : undefined), {interval: 250, timeout: 3_000}).catch(
      (e: unknown) => {
        if (isAttemptOver(e)) throw e
        return false
      }
    )
    if (took) return
  }
  throw new Error(`${what}: two clicks did not take`)
}

// Taps the one button labelled `label` (buttonLabelled), once it is drawn. Bound: 5s, the tap 1.
export const tapButton = async (label: string, what: string) => {
  const button = await waitFor(what, async () => buttonLabelled(label, what), {interval: 250, timeout: 5_000})
  await button.click()
}

// Puts `text` in the field `field` and reads it back, so a field that changed what was typed (a
// capital, a correction) fails before anything is submitted. The field is tapped at its frame's
// bottom-right corner (a tap takes whether XCUITest reports it visible or not, and puts the caret at
// the text's end), what it holds deleted and `text` typed, all as key presses: never WDA's setValue or
// clearValue, after which the app's process stays in hardware-keyboard mode and a later focus draws
// no software keyboard until the app relaunches. Bound: the field 10, the typing 15 (the tap 1, its
// 1s settle, the keys), the read 1 = 26.
export const fillField = async (field: () => ChainablePromiseElement, text: string, what: string) => {
  await field().waitForExist({timeout: 10_000})
  const rect = await rectOf(await field().getElement())
  if (!rect) throw new Error(`${what} has no position`)
  await tapFrame({height: 8, width: 8, x: rect.x + rect.width - 12, y: rect.y + rect.height - 12}, what)
  await browser.pause(1_000)
  const held = (await field().getAttribute('value')) ?? ''
  const placeholder = (await field().getAttribute('placeholderValue')) ?? ''
  const length = held === placeholder ? 0 : [...held].length
  if (length) await typeIntoFocused(what, '\uE003'.repeat(length))
  await typeIntoFocused(what, text)
  const got = await field().getAttribute('value')
  if (got !== text) throw new Error(`${what} does not read what was typed`)
}

// Puts `text` in the field `fieldTestID` that XCUITest cannot see (the editing row of a new folder or
// a rename is one accessible element, so its field is not in the tree): the field is focused through
// the app and set through its own onChange (secret-input's path; key presses dropped letters now and
// then), then read back from the app. Bound: the focus 10 (its eval and 5 of reads), the set 15 (two
// evals and 5 of length reads), the read back 5 = 30.
export const fillHiddenField = async (fieldTestID: string, text: string, what: string) => {
  await focusSecretField(fieldTestID)
  await setFieldText(fieldTestID, text)
  await waitFor(`${what} to read what was set`, async () => ((await focusedFieldText(fieldTestID)) === text ? true : undefined), {
    interval: 250,
    timeout: 5_000,
  })
}

// Types `text` into the SearchFilter on screen (the team builder's, a picker's): its box is one
// accessible element with the field not in the tree, so the box is pressed unless the keyboard is
// already up, and the text goes in as key presses. Bound: the box 10, its press 2, the keyboard 5,
// the keys 15 = 32.
export const typeInFilter = async (text: string, what: string) => {
  await browser.$(`~${T.SEARCH_FILTER}`).waitForExist({timeout: 10_000})
  if (!(await isKeyboardUp())) {
    // a filter of another tab's screen can be in the tree too: the visible one, else the newest
    const boxes = await browser.$$(`~${T.SEARCH_FILTER}`).getElements()
    let box = boxes.at(-1)!
    for (const e of boxes) if ((await e.getAttribute('visible').catch(() => null)) === 'true') box = e
    await press(box, what)
  }
  await waitFor('the keyboard', async () => ((await isKeyboardUp()) ? true : undefined), {interval: 250, timeout: 5_000})
  await typeIntoFocused(what, text)
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
