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
