// The desktop thread list's measuring and stepping rules, apart from the list they measure.

// A scroller within this many pixels of its end counts as at the end.
const endTolerancePx = 2
// A scroller within this many pixels of where the list put it is where the list put it.
const ownTolerancePx = 1
// A row overhanging the viewport by no more than this is wholly in view.
const rowEdgeTolerancePx = 1

export type ScrollerLike = {clientHeight: number; scrollHeight: number; scrollTop: number}
export type RectLike = {height: number; top: number}

export const distanceToEnd = (s: ScrollerLike) => s.scrollHeight - s.clientHeight - s.scrollTop
export const scrollerAtEnd = (s: ScrollerLike) => distanceToEnd(s) <= endTolerancePx

// How far the row sits below the middle of the view.
export const offsetFromMiddle = (row: RectLike, view: RectLike) => row.top + row.height / 2 - (view.top + view.height / 2)

// Whether the row is wholly inside the view once the scroller has moved down by shift.
export const rowWithinView = (row: RectLike, view: RectLike, shift: number) => {
  const top = row.top - shift
  return top >= view.top - rowEdgeTolerancePx && top + row.height <= view.top + view.height + rowEdgeTolerancePx
}

// Whether the scroller moving from offset from to offset now is the list's own doing: the list writes
// down where it is putting the scroller (listScroll) before it moves it, and a scroll of its own can
// land short of that, clamped to an extent (maxScroll) that has not caught up with new rows.
export const listMovedItself = (p: {from: number; listScroll: number; maxScroll: number; now: number}) => {
  const {from, listScroll, maxScroll, now} = p
  const toward = Math.min(listScroll, maxScroll)
  return now >= Math.min(from, toward) - ownTolerancePx && now <= Math.max(from, toward) + ownTolerancePx
}

// Where a reveal's animated scroll is going: the row's middle to the view's when the row is rendered
// to measure (offBy), and otherwise the end of the thread on the row's side of the view.
export const revealDestination = (p: {
  from: number
  max: number
  offBy: number | undefined
  rowBeforeRendered: boolean
}) => {
  const {from, max, offBy, rowBeforeRendered} = p
  if (offBy === undefined) return rowBeforeRendered ? 0 : max
  return Math.min(max, Math.max(0, from + offBy))
}

// Where the composer's page keys move the list: a viewport up or down.
export const pageOffset = (direction: 'up' | 'down', p: {scroll: number; scrollLength: number}) =>
  direction === 'up' ? Math.max(0, p.scroll - p.scrollLength) : p.scroll + p.scrollLength
