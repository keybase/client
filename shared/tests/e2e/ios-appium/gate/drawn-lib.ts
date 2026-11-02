// Pieces of the drawn-element reads in helpers/files.ts and helpers/menus.ts, kept apart so they can be
// unit-tested.
import {inside, type Rect} from './chat-lib.ts'

// How far a row the tree holds but that no hit drew lies from the screen's middle (its top's), to steer
// filesRowNamed's drags by; undefined to drag blind. A Files row steers from wherever it is (drawn
// outside the browser's frame, it is under a bar); another list's (inTree) only from off screen: one on
// screen that is still no hit (not among the visible rows) says nothing about which way to go.
export const steerOffset = (row: Rect | undefined, screen: Rect, files: boolean) =>
  !row || (!files && inside(row, screen)) ? undefined : row.y - screen.height / 2

// The long drags (half a screen each, at most four) toward a row `offset` from the screen's middle.
export const dragsToward = (offset: number, height: number) => Math.min(4, Math.ceil(Math.abs(offset) / (height * 0.5)))

// filesRowNamed's `inTree` reads the whole page source, so a row search `within` an element cannot
// take it: the pair is a caller's mistake, refused rather than one of them ignored.
export const checkRowSearch = ({inTree, within}: {inTree: boolean; within: boolean}) => {
  if (inTree && within) throw new Error('a row search takes inTree or within, not both')
}

// Which of the elements fetched again at a drawn element's type and frame is it: the one whose label
// (null: unread) `matches`. A covered screen keeps its elements in the tree, and its control can sit at
// the same frame (a wizard step's Skip under the next step's), so none or more than one throws rather
// than picking; the error names `what`, never a label.
export const oneLabelledAtFrame = (labels: ReadonlyArray<string | null>, matches: (label: string) => boolean, what: string) => {
  const at = labels.flatMap((l, i) => (l !== null && matches(l.replace(/\u00a0/g, ' ')) ? [i] : []))
  if (at.length !== 1) throw new Error(`${at.length} of ${what} at its frame, not one`)
  return at[0]!
}
