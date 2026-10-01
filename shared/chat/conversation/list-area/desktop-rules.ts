// The desktop thread list's measuring and stepping rules, apart from the list they measure.

// A row this close to the middle of the viewport is centred.
const centerTolerancePx = 8
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

// One look at the list while confirming its end held. The end held once it was at the end on two looks
// in a row with the content no taller on the second: the list reports a size change before the
// scroller's extent catches up with it, and a row can measure again a frame after its first
// measurement. Away from the end, the list is corrected only once its offset held still across two
// looks, so it has finished its own scroll, and at most twice: one for the header, one for whatever
// re-measured alongside it. Past that something else owns the offset.
export type EndCheck = {corrections: number; heldAtHeight: number | undefined; previousScroll: number | undefined}
export const startEndCheck: EndCheck = {corrections: 0, heldAtHeight: undefined, previousScroll: undefined}
export const stepEndCheck = (
  check: EndCheck,
  look: {atEnd: boolean; scroll: number; scrollHeight: number}
): {action: 'held' | 'correct' | 'wait' | 'giveUp'; check: EndCheck} => {
  if (look.atEnd) {
    if (check.heldAtHeight === look.scrollHeight) return {action: 'held', check}
    return {action: 'wait', check: {...check, heldAtHeight: look.scrollHeight, previousScroll: undefined}}
  }
  if (look.scroll !== check.previousScroll) {
    return {action: 'wait', check: {...check, heldAtHeight: undefined, previousScroll: look.scroll}}
  }
  const corrections = check.corrections + 1
  const next = {corrections, heldAtHeight: undefined, previousScroll: undefined}
  return {action: corrections > 2 ? 'giveUp' : 'correct', check: next}
}

// One step of centring a row. Until the row is rendered there is nothing to measure, so the list is
// asked to mount it. A row within the deadband three times is centred: chasing the remainder only
// fights the list's own sub-pixel adjustments. A correction that moved the scroller not at all three
// times running is pinned against an edge of the thread, where the row cannot reach the middle.
export type CenterCheck = {pinnedChecks: number; scrollAtLastRequest: number | undefined; settled: number}
export const startCenterCheck: CenterCheck = {pinnedChecks: 0, scrollAtLastRequest: undefined, settled: 0}
export type CenterStep = {type: 'mount'} | {type: 'done'} | {type: 'wait'} | {offset: number; type: 'scrollTo'}
export const stepCentering = (
  check: CenterCheck,
  offBy: number | undefined,
  scroll: number | undefined
): {check: CenterCheck; step: CenterStep} => {
  if (offBy === undefined) {
    return {check: {...check, pinnedChecks: 0, settled: 0}, step: {type: 'mount'}}
  }
  if (Math.abs(offBy) <= centerTolerancePx || scroll === undefined) {
    const settled = check.settled + 1
    return {
      check: {pinnedChecks: 0, scrollAtLastRequest: undefined, settled},
      step: {type: settled >= 3 ? 'done' : 'wait'},
    }
  }
  if (scroll === check.scrollAtLastRequest) {
    const pinnedChecks = check.pinnedChecks + 1
    return {check: {...check, pinnedChecks}, step: {type: pinnedChecks >= 3 ? 'done' : 'wait'}}
  }
  return {
    check: {...check, pinnedChecks: 0, scrollAtLastRequest: scroll},
    step: {offset: scroll + offBy, type: 'scrollTo'},
  }
}

// One look at a dataset's initial layout, which ends once the list's offset held still and no row
// changed size across two looks running.
export type LayoutCheck = {previousChanges: number; previousScroll: number | undefined; quiet: number}
export const stepLayoutCheck = (
  check: LayoutCheck,
  look: {changes: number; scroll: number | undefined}
): {check: LayoutCheck; settled: boolean} => {
  const {changes, scroll} = look
  if (scroll === undefined || changes !== check.previousChanges || scroll !== check.previousScroll) {
    return {check: {previousChanges: changes, previousScroll: scroll, quiet: 0}, settled: false}
  }
  const quiet = check.quiet + 1
  return {check: {...check, quiet}, settled: quiet >= 2}
}
