// Pieces of the drawn-element reads in helpers/files.ts and helpers/menus.ts, kept apart so they can be
// unit-tested.
import {frameInside, type Rect} from './chat-lib.ts'
import {sourceElements, sourceParents} from './page-source-lib.ts'

// How far a row the tree holds but that no hit drew lies from the screen's middle (its top's), to steer
// filesRowNamed's drags by; undefined to drag blind. A Files row steers from wherever it is (drawn
// outside the browser's frame, it is under a bar); another list's (inTree) only from off screen: one on
// screen that is still no hit (not among the visible rows) says nothing about which way to go.
export const steerOffset = (row: Rect | undefined, screen: Rect, files: boolean) =>
  !row || (!files && frameInside(row, screen)) ? undefined : row.y - screen.height / 2

// The long drags (half a screen each, at most four) toward a row `offset` from the screen's middle.
export const dragsToward = (offset: number, height: number) => Math.min(4, Math.ceil(Math.abs(offset) / (height * 0.5)))

// How many page-source elements of `type` lie exactly at `rect` (only visible ones when `visibleOnly`,
// as the fetch at that frame asks) and read a label that `matches`, when they are one control: nested
// boxes on one ancestor chain can share a frame exactly and are the same tap. Matches in different
// subtrees (a covered screen keeps its elements in the tree, and its control can sit at the same frame:
// a wizard step's Skip under the next step's), or none, throw rather than picking; the error names
// `what`, never a label.
export const oneControlAtFrame = (
  source: string,
  {matches, rect, type, visibleOnly}: {matches: (label: string) => boolean; rect: Rect; type: string; visibleOnly: boolean},
  what: string
) => {
  const parents = sourceParents(source)
  const at = sourceElements(source).flatMap((e, n) =>
    e.type === type &&
    (!visibleOnly || e.attrs['visible'] === 'true') &&
    (['height', 'width', 'x', 'y'] as const).every(k => Number(e.attrs[k]) === rect[k]) &&
    matches((e.attrs['label'] ?? '').replace(/\u00a0/g, ' '))
      ? [n]
      : []
  )
  if (!at.length) throw new Error(`0 of ${what} at its frame in the page source, not one`)
  const holds = (outer: number, inner: number): boolean => {
    const up = parents[inner] ?? -1
    return up === outer || (up > outer && holds(outer, up))
  }
  // in document order an ancestor comes before what it holds, so one chain holds each match in the last
  for (let k = 1; k < at.length; k++) {
    if (!holds(at[k - 1]!, at[k]!)) throw new Error(`${at.length} of ${what} at its frame in different subtrees, not one`)
  }
  return at.length
}

// Which of the elements fetched again at a drawn element's type and frame is it, given their labels
// (null: unread) and how many of them oneControlAtFrame read as one control: the deepest, which the
// fetch returns last of those whose label `matches`. Another count of matches (the tree moved between
// the reads) throws.
export const deepestLabelledAtFrame = (
  labels: ReadonlyArray<string | null>,
  matches: (label: string) => boolean,
  count: number,
  what: string
) => {
  const at = labels.flatMap((l, i) => (l !== null && matches(l.replace(/\u00a0/g, ' ')) ? [i] : []))
  if (at.length !== count) throw new Error(`${at.length} of ${what} at its frame, ${count} in the page source`)
  return at.at(-1)!
}
