// Generic helpers for the iOS flows' bottom-sheet menus (FloatingMenu) and labelled elements: open a
// sheet, read and pick its items, and find the one element whose label is a name, compared in memory
// so the name never goes into a selector or an error.
import {waitFor} from './lifecycle'
import {innermost, inside, rectOf, sheetItemLabels, type Rect} from '../gate/chat-lib.ts'
import {sourceElements} from '../gate/page-source-lib.ts'

// The open menu sheets: one reported visible, or one whose top is on the screen's upper part, above
// the bottom SHEET_PEEK points of the window. XCUITest reports a sheet (and its items) visible=false
// now and then while it is up, so `visible` alone misses it; a closed message menu's sheet can stay in
// the tree, moved below the screen, so the tree alone would never see it close. Bound: the window
// read 1.
const SHEET_PEEK = 114
export const openSheets = async () => {
  const {height} = await browser.getWindowRect()
  return `-ios predicate string:label == "Bottom Sheet" AND (visible == 1 OR rect.y < ${height - SHEET_PEEK})`
}
export const menuSheet = async () => browser.$(await openSheets())

// An item in the open menu sheet; its rows read ", <item>" (an icon, then the text).
const menuItemPredicate = (label: string) =>
  `-ios predicate string:type == "XCUIElementTypeOther" AND (label == ${JSON.stringify(label)} OR label ENDSWITH ${JSON.stringify(`, ${label}`)})`
const offers = (labels: ReadonlyArray<string>, label: string) => labels.some(l => l === label || l.endsWith(`, ${label}`))

// Drags the open sheet up by 300 points, from near the screen's bottom, to bring later items on screen.
const dragSheetUp = async () => {
  const {height, width} = await browser.getWindowRect()
  const x = Math.round(width / 2)
  await browser
    .action('pointer', {parameters: {pointerType: 'touch'}})
    .move({x, y: height - 80})
    .down()
    .move({duration: 400, x, y: height - 380})
    .pause(200)
    .up()
    .perform()
}

// Every item label of the open menu sheet: the items drawn on screen inside the sheet, read as the
// sheet is dragged up until a drag shows nothing new (its end), so an item below the fold counts.
// Bound: 15s.
export const menuLabels = async (): Promise<Array<string>> => {
  if (!(await (await menuSheet()).isExisting())) throw new Error('no menu sheet is open')
  const seen = new Set<string>()
  // one page source a reading (a call per element made a reading take seconds); `visible` is kept,
  // so rows the sheet covers do not count
  const shown = async () => sheetItemLabels(sourceElements(await browser.getPageSource())) ?? []
  let before = ''
  await waitFor(
    'the menu sheet read to its end',
    async () => {
      const now = await shown()
      // a sheet still sliding in reads no items: never the end, and nothing to drag yet
      if (!now.length) return undefined
      for (const l of now) seen.add(l)
      const signature = now.join('\n')
      if (signature === before) return true
      before = signature
      await dragSheetUp()
      return undefined
    },
    {interval: 300, timeout: 15_000}
  )
  return [...seen]
}

// Whether the open menu sheet holds the item `label` anywhere in it (menuLabels). Bound: 15s.
export const menuHas = async (label: string) => offers(await menuLabels(), label)
export const menuOffers = offers

// Waits for the open sheet to leave the tree, then reads the screen under it positively (a navigation
// or tab bar in the tree): an absence alone could be a read of an empty or failed tree. Rejects
// (as waitForExist does) when the sheet stays. Bound: `timeout`, the bar read 1.
export const waitForSheetGone = async (timeout: number) => {
  await (await menuSheet()).waitForExist({reverse: true, timeout})
  const bars = await browser.$$('-ios predicate string:type == "XCUIElementTypeNavigationBar" OR type == "XCUIElementTypeTabBar"').length
  if (!bars) throw new Error('the menu sheet left, but no screen under it reads back')
}

// A touch drag from `from` to `to`, held still before lifting so the list does not fling on. Bound: 1.
export const dragBetween = async (from: {x: number; y: number}, to: {x: number; y: number}, duration = 300) =>
  browser
    .action('pointer', {parameters: {pointerType: 'touch'}})
    .move({x: Math.round(from.x), y: Math.round(from.y)})
    .down()
    .move({duration, x: Math.round(to.x), y: Math.round(to.y)})
    .pause(200)
    .up()
    .perform()

// A drag up from the screen's bottom, which pulls an open sheet up (or scrolls it once it tops out).
// Bound: 1.
export const dragSheetUp = async () => {
  const {height, width} = await browser.getWindowRect()
  await dragBetween({x: width / 2, y: height - 80}, {x: width / 2, y: height - 380}, 400)
}

// The item `label` of the open sheet: the one reported visible, else the one drawn inside the sheet
// (see menuSheet), with whether it reads visible. Undefined when there is none; throws on more than one.
const sheetItem = async (label: string) => {
  const shown = await browser.$$(`${menuItemPredicate(label)} AND visible == 1`).getElements()
  if (shown.length) return {e: shown[0]!, visible: true}
  const sheets: Array<Rect> = []
  for (const sh of await browser.$$(await openSheets()).getElements()) {
    const r = await rectOf(sh)
    if (r) sheets.push(r)
  }
  const found: Array<{e: WebdriverIO.Element; rect: Rect}> = []
  for (const e of await browser.$$(menuItemPredicate(label)).getElements()) {
    const r = await rectOf(e)
    if (r && sheets.some(sh => inside(r, sh))) found.push({e, rect: r})
  }
  const inner = innermost(found.map(f => f.rect))
  if (inner.length > 1) throw new Error(`${inner.length} sheet items "${label}", not one`)
  return inner.length ? {e: found[inner[0]!]!.e, visible: false} : undefined
}

// Taps a sheet item: a click when XCUITest reports it visible, else a tap at its frame (a click on an
// element reported visible=false taps nothing).
const tapSheetItem = async (item: {e: WebdriverIO.Element; visible: boolean}) => {
  if (item.visible) return item.e.click()
  const r = await rectOf(item.e)
  if (!r) throw new Error('a sheet item has no position')
  return browser.execute('mobile: tap', {x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2)})
}

// Taps the open sheet's item `label` once, for an item whose sheet stays up after it. Bound: the read
// 1, the tap 1.
export const tapMenuItemOnce = async (label: string) => {
  const item = await sheetItem(label)
  if (!item) throw new Error(`no "${label}" in the menu`)
  await tapSheetItem(item)
}

// Scrolls the menu until `label` shows, and taps it. The sheet opens partway, so later items start
// below the screen.
export const chooseMenuItem = async (label: string) => {
  await waitFor(
    `"${label}" in the menu`,
    async () => {
      const item = await sheetItem(label)
      if (item) {
        // A tap lands at the item's middle; once that is on screen the item can be tapped. The sheet
        // tops out with its last items low on the screen, where no drag moves them further up.
        const {y} = await item.e.getLocation()
        const {height: itemHeight} = await item.e.getSize()
        const {height} = await browser.getWindowRect()
        if (y + itemHeight / 2 < height) return true
      }
      await dragSheetUp()
      return undefined
    },
    {interval: 300, timeout: 15_000}
  )
  // A tap while the sheet still settles after a drag can do nothing (seen live): the item is tapped
  // again only while the sheet and the item are both still up, so a tap that took is never repeated.
  // Bound: two tries of the tap and 2.5s, or one and a last 2.5s for the sheet to go = 5s, as the one
  // 5s wait was.
  for (let tap = 1; ; tap++) {
    const item = await sheetItem(label)
    if (!item) throw new Error(`"${label}" left the menu before it was tapped`)
    await tapSheetItem(item)
    const closed = await waitForSheetGone(2_500)
      .then(() => true)
      .catch(() => false)
    if (closed) return
    // the tap took and the sheet is on its way down
    if (!(await sheetItem(label))) {
      await waitForSheetGone(2_500)
      return
    }
    if (tap >= 2) throw new Error(`the menu sheet is still up after "${label}" was tapped twice`)
  }
}

// Opens a menu sheet with `open` (a tap or a long press, done afresh each try, as the sheet ignores
// one that lands while the screen is still settling), and waits for the sheet. Bound: `timeout`.
export const openSheetWith = async (what: string, open: () => Promise<unknown>, timeout = 15_000) =>
  waitFor(
    what,
    async () => {
      if (await (await menuSheet()).isExisting()) return true
      await open()
      return (await (await menuSheet()).waitForExist({interval: 150, timeout: 3_000}).catch(() => false)) ? true : undefined
    },
    {interval: 300, timeout}
  )

// Opens the menu sheet `tap` shows (a tap on a gear, a dropdown). Bound: 15s.
export const openMenuFrom = async (what: string, tap: () => Promise<unknown>) =>
  openSheetWith(what, async () => tap().catch(() => {}))

// What `selector` finds; for a selector that asks for `visible == 1` and finds nothing, what it finds
// without that and drawn on screen (a modal or sheet XCUITest reports invisible now and then). Bound:
// two reads 2, and a frame read per element of the fallback.
const VISIBLE_CLAUSE = ' AND visible == 1'
export const elementsOrUnseen = async (selector: string) => {
  const found = await browser.$$(selector).getElements()
  if (found.length || !selector.endsWith(VISIBLE_CLAUSE)) return [...found]
  // only those drawn on screen: a screen under the top one keeps its elements in the tree
  const {height, width} = await browser.getWindowRect()
  const onScreen: Array<WebdriverIO.Element> = []
  for (const e of await browser.$$(selector.slice(0, -VISIBLE_CLAUSE.length)).getElements()) {
    const r = await rectOf(e)
    if (r && inside(r, {height, width, x: 0, y: 0})) onScreen.push(e)
  }
  return onScreen
}

// Throws `message` unless `ok`.
export const check = (ok: boolean, message: string) => {
  if (!ok) throw new Error(message)
}

// What `selector` finds, or for a tap (`forTap`) elementsOrUnseen's read: a presence read never takes
// an element XCUITest reports invisible.
const candidates = async (selector: string, {forTap = false}: DrawnOptions = {}) =>
  forTap ? elementsOrUnseen(selector) : browser.$$(selector).getElements()

// The one element on screen whose label is exactly `label`, of those `selector` finds: compared in
// memory, so a label holding an account name never goes into a selector or an error. Where nested
// elements expose the same label (a pressable box and its text) the innermost is it. Throws when
// none or more than one is drawn; `what` names it. `opts` as drawnElementIn's.
export const labelledElement = async (selector: string, label: string, what: string, opts?: DrawnOptions) => {
  const found: Array<{e: WebdriverIO.Element; rect: {height: number; width: number; x: number; y: number}}> = []
  for (const e of await candidates(selector, opts)) {
    if ((await e.getAttribute('label').catch(() => null)) !== label) continue
    const at = await e.getLocation().catch(() => undefined)
    const size = await e.getSize().catch(() => undefined)
    if (at && size) found.push({e, rect: {...at, ...size}})
  }
  const inner = innermost(found.map(f => f.rect))
  if (inner.length !== 1) throw new Error(`${inner.length} of ${what} on screen, not one`)
  return found[inner[0]!]!.e
}

// Every visible button, for labelledElement.
export const BUTTON_ELEMENTS = '-ios predicate string:type == "XCUIElementTypeButton" AND visible == 1'

// The visible button labelled `label`, tapped once the screen draws it. Bound: the find 5, the tap
// 1 = 6.
export const tapButton = async (label: string, what: string) =>
  (await waitFor(what, async () => labelledElement(BUTTON_ELEMENTS, label, what), {interval: 300, timeout: 5_000})).click()

// The one element on screen of those `selector` finds whose label, split at its ", " joins, holds
// `name` as a part (a tappable row merges its texts into one label): compared in memory, so a name
// never goes into a selector or an error. The innermost of nested matches; none or more than one
// throws. `what` names it. `opts` as drawnElementIn's.
export const elementWithLabelPart = async (selector: string, name: string, what: string, opts?: DrawnOptions) => {
  const found: Array<{e: WebdriverIO.Element; rect: {height: number; width: number; x: number; y: number}}> = []
  for (const e of await candidates(selector, opts)) {
    const label = ((await e.getAttribute('label').catch(() => null)) ?? '').replace(/\u00a0/g, ' ')
    if (!label.split(', ').some(part => part.trim() === name)) continue
    const at = await e.getLocation().catch(() => undefined)
    const size = await e.getSize().catch(() => undefined)
    if (at && size) found.push({e, rect: {...at, ...size}})
  }
  const inner = innermost(found.map(f => f.rect))
  if (inner.length !== 1) throw new Error(`${inner.length} of ${what} on screen, not one`)
  return found[inner[0]!]!.e
}

// What a row's name can be drawn as: its own text, a pressable text (a link), or a tappable box
// merging its texts.
export const NAMED_ELEMENT_TYPES: ReadonlyArray<string> = ['XCUIElementTypeStaticText', 'XCUIElementTypeLink', 'XCUIElementTypeOther']
// For a tap only, not a presence read: when XCUITest reports none of the matches visible (a modal
// or sheet it reports invisible now and then), the one of them whose frame lies wholly on screen.
export type DrawnOptions = {forTap?: boolean}

// The one visible element of `types` whose label, split at its ", " joins, holds `name` as a part (a
// tappable row merges its texts into one label), read off one page source (a call per element on a
// screen of rows is too slow) and compared in memory; then that element fetched by its type and
// frame, so no selector or error ever holds `name`. The innermost of nested matches; none or more
// than one throws. `what` names it.
export const elementWithLabelPartIn = async (types: ReadonlyArray<string>, name: string, what: string, opts?: DrawnOptions) =>
  drawnElementIn(types, label => label.split(', ').some(part => part.trim() === name), what, opts)

// The one visible element of `types` labelled exactly `label`, read as elementWithLabelPartIn reads.
export const elementLabelledIn = async (types: ReadonlyArray<string>, label: string, what: string, opts?: DrawnOptions) =>
  drawnElementIn(types, l => l === label, what, opts)

// The one visible element of `types` whose label is `title` or starts `<title>, ` (a card's box merges
// its title and subtitle, and a title can hold ", " itself), read as elementWithLabelPartIn reads.
export const cardTitledIn = async (types: ReadonlyArray<string>, title: string, what: string, opts?: DrawnOptions) =>
  drawnElementIn(types, l => l === title || l.startsWith(`${title}, `), what, opts)

const drawnElementIn = async (types: ReadonlyArray<string>, matches: (label: string) => boolean, what: string, {forTap = false}: DrawnOptions = {}) => {
  const all = sourceElements(await browser.getPageSource())
    .filter(e => types.includes(e.type) && matches((e.attrs['label'] ?? '').replace(/\u00a0/g, ' ')))
    .map(e => ({
      e,
      r: {height: Number(e.attrs['height']), width: Number(e.attrs['width']), x: Number(e.attrs['x']), y: Number(e.attrs['y'])},
    }))
  const shown = all.filter(({e}) => e.attrs['visible'] === 'true')
  // a tap's fallback keeps to frames wholly on screen: a screen under the top one, and a list's rows
  // scrolled away, keep their elements in the tree
  const {height, width} = forTap && !shown.length ? await browser.getWindowRect() : {height: 0, width: 0}
  const found = shown.length || !forTap ? shown : all.filter(({r}) => inside(r, {height, width, x: 0, y: 0}))
  const rects = found.map(f => f.r)
  const inner = innermost(rects)
  if (inner.length !== 1) {
    const at = inner.map(k => `${found[k]!.e.type.replace('XCUIElementType', '')} ${rects[k]!.x},${rects[k]!.y} ${rects[k]!.width}x${rects[k]!.height}`)
    throw new Error(`${inner.length} of ${what} on screen, not one${at.length ? `: ${at.join('; ')}` : ''}`)
  }
  const i = inner[0]!
  const r = rects[i]!
  const at = `rect.x == ${r.x} AND rect.y == ${r.y} AND rect.width == ${r.width} AND rect.height == ${r.height}`
  // nested boxes can share the row's frame exactly: any of them is the same tap, the deepest is taken
  const els = await browser.$$(`-ios predicate string:type == "${found[i]!.e.type}" AND ${at}`).getElements()
  const deepest = els.at(-1)
  if (!deepest) throw new Error(`no element at the frame of ${what}`)
  return deepest
}
