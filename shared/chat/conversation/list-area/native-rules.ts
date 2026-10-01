// The native thread list's measuring and stepping rules, apart from the list they measure. The list is
// inverted: its offset rises toward the oldest row, and the newest rests at the resting offset,
// negative while the keyboard is up.

// An offset within this many points of the resting offset is at the end.
const endTolerance = 8
// A row overhanging the part of the list in view by no more than this is wholly in view.
const rowEdgeTolerance = 1
// The list moving by less than this has not moved.
const stillPoints = 1
// The centring corrector's whole budget, in steps.
const centerSteps = 13
// Each corrector step moves this share of the distance it estimates, so it never overshoots.
const centerDamping = 0.9

export type RowFrame = {height: number; y: number}

export const atRestingEnd = (offset: number, resting: number) => offset <= resting + endTolerance

// Whether the row is wholly in the part of the list nothing covers: the keyboard, and the composer
// riding it, cover its bottom by as much as the resting offset sits below 0.
export const rowUncovered = (frame: RowFrame, p: {offset: number; resting: number; viewport: number}) =>
  frame.y >= p.offset - p.resting - rowEdgeTolerance && frame.y + frame.height <= p.offset + p.viewport + rowEdgeTolerance

export type ScrollReport = {content: number; offset: number; resting: number}

// Whether the list moving from one scroll report to the next is the reader. The list moves itself only
// by the scrolls it issues (carried, asked only when nothing else explains the movement, as asking can
// end the scroll in flight), by its content changing size, by its resting offset moving, and, while
// it owns the end, by its anchor bringing a new message into view.
export const readerMovedList = (
  last: ScrollReport | undefined,
  now: ScrollReport,
  p: {carried: () => boolean; ownsEnd: boolean}
) =>
  !!last &&
  Math.abs(now.offset - last.offset) >= stillPoints &&
  now.content === last.content &&
  now.resting === last.resting &&
  !p.carried() &&
  !(p.ownsEnd && Math.abs(now.offset - now.resting) < Math.abs(last.offset - now.resting))

// Where a scroll to a row is heading, for telling its movement from the reader's; undefined when that
// is not known. A row the list has laid out lands at its middle in the view, raised by lift. Otherwise
// only which way it lies from the middle of the view is known: older rows sit at higher offsets.
export const itemScrollHeading = (p: {
  first: number | null | undefined
  frame: RowFrame | undefined
  index: number
  last: number | null | undefined
  lift: number
  offset: number | undefined
  viewport: number | undefined
}) => {
  const {first, frame, index, last, lift, offset, viewport} = p
  if (lift && frame && offset !== undefined && viewport !== undefined) {
    return frame.y + (frame.height - viewport) / 2 - lift
  }
  if (first != null && last != null && index >= 0) return index >= (first + last) / 2 ? Infinity : -Infinity
  return undefined
}

// One corrector step toward a centred row, from the rows in view (first and last data indices) and the
// list's offset: settle when the row is at the middle, the budget is spent, or the step would move
// nothing (a row among the newest or oldest cannot reach the middle); wait while the list has not
// reported its size and offset; otherwise step by the row distance at the average row height.
export type CorrectorStep = {type: 'settle'} | {type: 'wait'} | {offset: number; type: 'step'}
export const correctorStep = (p: {
  content: number | undefined
  first: number
  iters: number
  last: number
  offset: number | undefined
  resting: number
  rows: number
  targetIndex: number
  viewport: number | undefined
}): CorrectorStep => {
  const {content, first, iters, last, offset, resting, rows, targetIndex, viewport} = p
  const diff = targetIndex - (first + last) / 2
  if (Math.abs(diff) <= 0.5 || iters >= centerSteps) return {type: 'settle'}
  if (content === undefined || offset === undefined || viewport === undefined) return {type: 'wait'}
  const maxOffset = Math.max(0, content - viewport)
  const averageRowHeight = content / rows
  const next = Math.min(maxOffset, Math.max(resting, offset + diff * averageRowHeight * centerDamping))
  if (Math.abs(next - offset) < 1) return {type: 'settle'}
  return {offset: next, type: 'step'}
}

// Whether a newest row is a new message appended to the thread: not older rows loading, or a cleared
// thread refilling.
export const isAppend = (p: {newest: number | undefined; previousNewest: number | undefined; sameDataset: boolean}) =>
  p.sameDataset && p.newest !== undefined && p.previousNewest !== undefined && p.newest > p.previousNewest
