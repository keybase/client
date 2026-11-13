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
import {elementInRow, frameInside, innermost, rectOf, type Rect} from '../gate/chat-lib.ts'
import {dragsToward, steerOffset} from '../gate/drawn-lib.ts'
import {framePredicate, labelHas, sourceElements, sourceRect} from '../gate/page-source-lib.ts'
import {isAttemptOver} from '../gate/attempt-binding-lib'
import {jsEval} from '../gate/app-ask.ts'
import {focusedFieldText, focusSecretField, setFieldText} from '../gate/secret-input.ts'
import {isKeyboardUp, typeIntoFocused} from './chat'
import {BUTTON_ELEMENTS, dragBetween, frameOf, labelledElement, openMenuFrom, press, screenRect, tapElement, tapFrame} from './menus'
import {waitFor} from './lifecycle'
import {expectScreen} from '../gate/screens.ts'
import {backUntil, goBack, openTabRoot} from './navigate'

// The folder screen of `path`. Bound: 10s, plus one read 1.
export const expectFolder = async (what: string, path: string) => expectScreen(what, 'fsBrowse', p => p['path'] === path)

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
  return rect ?? screenRect()
}

// The Files rows go by their frame in the browser; any other list's rows (a team's members) by
// `visible`, as XCUITest mostly reports those.
const isFilesRow = (testID: string) => testID === T.FILES_ROW || testID === T.FILES_TLF_ROW

export type DrawnRow = {e: WebdriverIO.Element; rect: Rect}

// The element with `testID` drawn (a Files row: wholly inside the list, rowArea) whose label holds `name` as a part
// (the innermost of nested matches), under `within` when given, or undefined when none is; and what
// every such element reads, to tell a drag that moved the list from one that did not. Throws when more
// than one matches. `inTree` as filesRowNamed's.
const drawnNamed = async (testID: string, name: string, within?: WebdriverIO.Element, inTree = false) => {
  const files = isFilesRow(testID)
  const area = files ? await rowArea(within) : undefined
  // another list's rows go by `visible`, unless XCUITest reports none of them visible (a modal it
  // reports invisible now and then): then every one in the tree
  const pick = <E,>(all: Array<E>, visible: (e: E) => boolean) => {
    const shown = files ? [] : all.filter(visible)
    return files || !shown.length ? all : shown
  }
  if (!within) {
    const screen = await screenRect()
    // one page source, not a call per row and attribute (a list of a hundred teams took seconds a read)
    const all = sourceElements(await browser.getPageSource()).filter(e => e.attrs['name'] === testID)
    const candidates = pick(all, e => e.attrs['visible'] === 'true')
    // a Files row is taken wherever it is drawn in the files browser, reported visible or not (a
    // folder screen reports every element invisible); another list's row only among the candidates,
    // on screen
    const hits = (files ? all : candidates)
      .filter(e => labelHas(e.attrs['label'] ?? '', name))
      .map(e => sourceRect(e.attrs))
      .filter(r => frameInside(r, area ?? screen))
    const inner = innermost(hits)
    if (inner.length > 1) throw new Error(`${inner.length} rows of the one name drawn, not one`)
    const signature = candidates.map(e => e.attrs['label'] ?? '').join('\n')
    if (!inner.length) {
      // the Files list, which is not virtualized, keeps its off-screen rows in the tree: which way the
      // row is. Another list's off-screen element can be a covered screen's, so it steers nothing
      // unless the caller says only this list draws the testID and keeps every row (inTree).
      const off = files || inTree ? all.find(e => labelHas(e.attrs['label'] ?? '', name)) : undefined
      return {offscreen: steerOffset(off && sourceRect(off.attrs), screen, files), row: undefined, signature}
    }
    const r = hits[inner[0]!]!
    const e = (await browser.$$(`-ios predicate string:name == ${JSON.stringify(testID)} AND ${framePredicate(r)}`).getElements()).at(-1)
    return {row: e ? {e, rect: r} : undefined, signature}
  }
  const found: Array<DrawnRow> = []
  const labels: Array<string> = []
  const byID = `-ios predicate string:name == ${JSON.stringify(testID)}`
  const shown = files ? [] : await within.$$(`${byID} AND visible == 1`).getElements()
  for (const e of files || !shown.length ? await within.$$(byID).getElements() : shown) {
    const label = (await e.getAttribute('label').catch(() => null)) ?? ''
    labels.push(label)
    if (!labelHas(label, name)) continue
    const rect = await rectOf(e)
    if (rect && (!area || frameInside(rect, area))) found.push({e, rect})
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
// (inside `timeout`). `inTree` is for another list that is not virtualized and that no screen under it
// draws `testID` in (the profile's Add to team): its row off screen steers the drags as a Files row
// does, instead of blind drags that can carry a hundred-row list past it. A tap still takes only a
// row drawn on screen. It reads the whole page source, so it takes no `within`.
export const filesRowNamed = async (
  name: string,
  what: string,
  {
    inTree = false,
    testID = T.FILES_ROW,
    timeout = 30_000,
    within,
  }: {testID?: string; timeout?: number} & ({inTree?: boolean; within?: never} | {inTree?: never; within?: WebdriverIO.Element}) = {}
): Promise<DrawnRow> => {
  let towardEnd = true
  let before: string | undefined
  let dragged = false
  return waitFor(
    what,
    async () => {
      const {offscreen, row, signature} = await drawnNamed(testID, name, within, inTree)
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
      // long drags toward it, up to four between reads; none (it is at the middle) drags blind
      const toward = offscreen === undefined ? 0 : dragsToward(offscreen, height)
      if (offscreen !== undefined && toward > 0) {
        for (let i = 0; i < toward; i++) {
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
export const openFilesRoot = async () => openTabRoot('Files', T.FILES_TLF_ROW, 'fsRoot')

// Back from a folder to the Files tab's root (on a phone a folder is pushed above the tab bar, so
// back is the way out). Bound: 30s of tries, overrun by one (the back 3, the screen 5 and its read 1) = 39.
export const backToFilesRoot = async () => backUntil("back to the Files tab's root", 'fsRoot', () => true, goBack)

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

// Opens the sheet behind one of the folder header's native menu items: the header's More pill opens
// a native menu (Filter, Upload, More), and its More item opens the folder's "..." sheet, its Upload
// item the upload sheet. Bound: the pill 1, openMenuFrom 15 overrun by one try (the pill tap 1, the
// menu 5, its items read 2 and tapped 1, the sheet 3) = 28.
const openFolderHeaderSheet = async (item: 'More' | 'Upload', what: string) => {
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
  await openMenuFrom(what, async () => {
    if (!(await filter.isExisting())) {
      await tapFrame(pillRect, "the header's More pill")
      await filter.waitForExist({timeout: 5_000})
    }
    // the menu's own item, not the pill that opened it
    const items: Array<DrawnRow> = []
    for (const e of await browser.$$(`-ios predicate string:type == "XCUIElementTypeButton" AND label == "${item}"`).getElements()) {
      const rect = await rectOf(e)
      if (rect && !sameRect(rect, pillRect)) items.push({e, rect})
    }
    const inner = innermost(items.map(i => i.rect))
    if (inner.length !== 1) throw new Error(`${inner.length} ${item} items in the header's menu, not one`)
    await tapFrame(items[inner[0]!]!.rect, `the menu's ${item}`)
  })
}

// The folder's "..." sheet. Bound: 28.
export const openFolderMoreSheet = async () => openFolderHeaderSheet('More', "the folder's More sheet")

// The folder's upload sheet (Upload photos/videos, Upload file). Bound: 28.
export const openFolderUploadSheet = async () => openFolderHeaderSheet('Upload', "the folder's upload sheet")

// The buttons of the topmost drawn screen, whether XCUITest reports them visible or not: with no modal
// up (the app's own modal stack), those wholly on screen (a page pushed over another takes the one
// under it out of the tree); with one up, those inside the topmost modal's own subtree (its content,
// MODAL_SCREEN, and the navigation bar above it), so a button of a screen the modal covers (a team
// page's Leave team, a folder's Delete) is never one of them. Throws when the topmost modal cannot be
// found. Bound: the eval 20, the reads 3.
const topScreenButtons = async (): Promise<Array<WebdriverIO.Element>> => {
  const modalUp = await jsEval<boolean>(`return kbModule('constants/router.tsx').getModalStack().length > 0`)
  if (!modalUp) {
    const screen = await screenRect()
    const out: Array<WebdriverIO.Element> = []
    for (const e of await browser.$$('-ios predicate string:type == "XCUIElementTypeButton"').getElements()) {
      const r = await rectOf(e)
      if (r && frameInside(r, screen)) out.push(e)
    }
    return out
  }
  // the last modal screen in the tree is the one presented last, on top
  const top = (await browser.$$(`~${T.MODAL_SCREEN}`).getElements()).at(-1)
  if (!top) throw new Error('a modal is up but no modal screen is in the tree: not tapping')
  // its nearest container holding a navigation bar and no other modal screen: the modal with its bar
  const withBar = await top.$(
    `./ancestor::*[.//XCUIElementTypeNavigationBar and count(.//*[@name="${T.MODAL_SCREEN}"]) = 1][1]`
  )
  const root = (await withBar.isExisting()) ? withBar : top
  return [...(await root.$$('.//XCUIElementTypeButton').getElements())]
}

// The one button labelled `label`: one reported visible, else (on a screen that reports its elements
// visible=false: a files confirmation, a modal stacked on a team page) the one among the topmost drawn
// screen's buttons (topScreenButtons), never one of a covered screen. A click on a button takes either
// way. Bound: one read 1, the fallback 23.
const topScreenButtonLabelled = async (label: string, what: string) => {
  const found: Array<{e: WebdriverIO.Element; rect: Rect}> = []
  for (const e of await topScreenButtons()) {
    if ((await e.getAttribute('label').catch(() => null)) !== label) continue
    const rect = await rectOf(e)
    if (rect) found.push({e, rect})
  }
  const inner = innermost(found.map(f => f.rect))
  if (inner.length !== 1) throw new Error(`${inner.length} of ${what} on the topmost screen, not one`)
  return found[inner[0]!]!.e
}
export const buttonLabelled = async (label: string, what: string) =>
  labelledElement(BUTTON_ELEMENTS, label, what).catch(async () => topScreenButtonLabelled(label, what))

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
  const rect = await frameOf(await field().getElement(), what)
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

// Whether the input the app has focused is inside a SearchFilter's box (the field itself carries no
// testID). A keyboard alone says nothing: another screen's field (the encrypt screen's, focused by an
// earlier flow) can hold focus and its keyboard while the filter is shown.
const filterHasFocus = async () =>
  jsEval<boolean>(`
    const f = kbModule('node_modules/react-native/index.js').TextInput.State.currentlyFocusedInput()
    let node = f && (f.__internalInstanceHandle || f._internalInstanceHandle)
    for (; node; node = node.return) {
      if (node.memoizedProps && node.memoizedProps.testID === ${JSON.stringify(T.SEARCH_FILTER)}) return true
    }
    return false
  `)

// Types `text` into the SearchFilter on screen (the team builder's, a picker's): its box is one
// accessible element with the field not in the tree, so the box is pressed unless its field already
// has focus, and the text goes in as key presses once the field has focus and the keyboard is up.
// Bound: the box 10, its press 2, the focus and keyboard 5, the keys 15 = 32.
export const typeInFilter = async (text: string, what: string) => {
  await browser.$(`~${T.SEARCH_FILTER}`).waitForExist({timeout: 10_000})
  if (!(await filterHasFocus())) {
    // a filter of another tab's screen can be in the tree too: the visible one, else the newest
    const boxes = await browser.$$(`~${T.SEARCH_FILTER}`).getElements()
    let box = boxes.at(-1)!
    for (const e of boxes) if ((await e.getAttribute('visible').catch(() => null)) === 'true') box = e
    await press(box, what)
  }
  try {
    await waitFor('the filter focused and the keyboard up', async () => ((await filterHasFocus()) && (await isKeyboardUp()) ? true : undefined), {
      interval: 250,
      timeout: 5_000,
    })
  } catch (e) {
    // which filter boxes the tree held, for whoever reads the failure: frames and visibility only
    const seen = []
    for (const b of await browser.$$(`~${T.SEARCH_FILTER}`).getElements()) {
      let frame = 'no frame'
      let visible = '?'
      try {
        frame = JSON.stringify(await browser.getElementRect(b.elementId))
        visible = (await b.getAttribute('visible')) ?? '?'
      } catch {}
      seen.push(`${frame} visible=${visible}`)
    }
    throw new Error(`${e instanceof Error ? e.message : String(e)} after pressing ${what} (filter boxes: ${seen.join('; ') || 'none'})`, {cause: e})
  }
  await typeIntoFocused(what, text)
}
