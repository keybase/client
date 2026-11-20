// What "shown" (XCUITest's `visible`) means on an iPhone Duo unfolded or in a Split View. There the app
// reports a portrait frame that its landscape window does not share, and every element of the base
// screens (the tabs and what is pushed on them) reads visible=false. A modal there is presented as a
// form sheet, over UIKit's dimming view (an element named PopoverDismissRegion), and its elements read
// `visible` truly, the covered screens' false. So on such a run (recorded once the posture is set:
// KB_IOS_FRAME_SHOWN, "<width>x<height>") XCUITest's flag stands while a dimming view is up; otherwise an
// element is shown when its frame starts inside the window. The page source reads (sourceElements) and
// the gate's element finds (shownFind, in wdio.gate.conf.ts) both apply it, so a selector or a source
// read that asks for `visible` works unchanged.

export const FRAME_SHOWN_VAR = 'KB_IOS_FRAME_SHOWN'

type Size = {height: number; width: number}
type Rect = Size & {x: number; y: number}

const frameWindow = (): Size | undefined => {
  const m = /^(\d+)x(\d+)$/.exec(process.env[FRAME_SHOWN_VAR] ?? '')
  return m ? {height: Number(m[2]), width: Number(m[1])} : undefined
}

// Whether this run reads "shown" off frames while no modal is up.
export const readsFrames = () => frameWindow() !== undefined

// Records that this run reads "shown" off frames, inside a window of `size`.
export const recordFrameShown = (size: Size) => {
  process.env[FRAME_SHOWN_VAR] = `${Math.round(size.width)}x${Math.round(size.height)}`
}

const frameIn = (r: Rect, w: Size) => r.width > 0 && r.height > 0 && r.x >= 0 && r.y >= 0 && r.x < w.width && r.y < w.height
const frameClause = (w: Size) =>
  `(rect.width > 0 AND rect.height > 0 AND rect.x >= 0 AND rect.y >= 0 AND rect.x < ${w.width} AND rect.y < ${w.height})`

// The name of UIKit's dimming view under a form sheet: while one is in the tree a modal is up.
const DIMMING_NAME = 'PopoverDismissRegion'
// A predicate for that dimming view.
export const DIMMING = `name == "${DIMMING_NAME}"`

// The `visible` each of a page source's elements (their frames and flags, in document order) should
// read: unchanged on a run that reads XCUITest's flag or while the source holds a dimming view, else
// whether its frame starts inside the window.
// With a modal up, its elements can read visible=false too: one in the top layer (the first window's
// last child, the modal) whose frame starts inside the window counts as well. `parents` are each
// element's parent index (page-source-lib.ts' sourceParents).
export const sourceVisible = (
  source: string,
  els: ReadonlyArray<{rect: Rect; type: string; visible: string | undefined}>,
  parents: () => ReadonlyArray<number>
): Array<string | undefined> => {
  const w = frameWindow()
  if (!w) return els.map(e => e.visible)
  if (!source.includes(`name="${DIMMING_NAME}"`)) return els.map(e => String(frameIn(e.rect, w)))
  const up = parents()
  const win = els.findIndex(e => e.type === 'XCUIElementTypeWindow')
  const top = els.findLastIndex((e, i) => up[i] === win && e.type === 'XCUIElementTypeOther')
  const under = (i: number): boolean => i === top || (i > top && i >= 0 && under(up[i] ?? -1))
  return els.map((e, i) => (e.visible === 'true' || (win >= 0 && top >= 0 && under(i) && frameIn(e.rect, w)) ? 'true' : e.visible))
}

// Whether a modal was up at the last read (notePresented), for the finds after it.
let presented = false
// The read notePresented has in flight.
let reading: Promise<void> | undefined

// The finds shownFind rewrites.
export const FIND_COMMANDS: ReadonlyArray<string> = ['findElement', 'findElements', 'findElementFromElement', 'findElementsFromElement']

// Reads whether a modal is up, for shownFind; run before each find (wdio.gate.conf.ts' beforeCommand).
// Finds that start while a read is in flight (a Promise.all) await that one read. Its own find, sent
// from inside the hook, runs no command hooks (wdio skips them for commands a hook sends), and is not
// one that asks for `visible`. A failed read leaves `presented` as it was. Bound: 1.
export const notePresented = async () => {
  const read = async () => {
    presented = (await browser.$$(`-ios predicate string:${DIMMING}`).length) > 0
  }
  reading ??= read()
    .catch(() => {})
    .finally(() => {
      reading = undefined
    })
  await reading
}

// `visible == 1` in a predicate, in any spacing, or as `visible == true`.
const VISIBLE_CLAUSE = /visible\s*==\s*(?:1|true)\b/g

// A find's `using` and `value` as the gate sends them: on a run that reads frames with no modal up (at
// the last notePresented), a predicate or class chain that asks for `visible == 1` (VISIBLE_CLAUSE)
// asks for a frame inside the window instead. Unchanged otherwise.
export const shownFind = (using: string, value: string): {using: string; value: string} => {
  const w = frameWindow()
  if (!w || presented) return {using, value}
  if (using !== '-ios predicate string' && using !== '-ios class chain') return {using, value}
  return {using, value: value.replace(VISIBLE_CLAUSE, frameClause(w))}
}

// Whether a live element is shown, as a find for `visible == 1` would read it. Bound: its reads 2.
export const elementShown = async (e: WebdriverIO.Element) => {
  const w = frameWindow()
  if (!w || presented) return (await e.getAttribute('visible').catch(() => null)) === 'true'
  const r = await browser.getElementRect(e.elementId).catch(() => undefined)
  return !!r && frameIn(r, w)
}

// elementShown for the first element `find` finds, false when it finds nothing. Bound: its reads 3.
export const shownNow = async (find: {getElement: () => Promise<WebdriverIO.Element>; isExisting: () => Promise<boolean>}) =>
  (await find.isExisting().catch(() => false)) && elementShown(await find.getElement())

// For tests: what the last notePresented read.
export const setPresentedForTest = (up: boolean) => {
  presented = up
}
