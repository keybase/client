import type {Rect} from './header-button-lib'

// Breathing room kept between a row and the bar it is dragged clear of.
export const CLEAR_MARGIN = 8
// How far inside the bars a row's middle, where a click taps it, must lie.
export const TAP_CLEARANCE = 16

// How far to drag a list's content (negative = up) so a click at `row`'s middle lands on it: its middle
// at least TAP_CLEARANCE inside `top` (the safe area's and nav bar's bottom) and `bottom` (the
// floating tab bar's top, or the screen's bottom). 0 when it already is: a list's first row can sit
// right under the nav bar and its last partly under the floating tab bar, where no drag moves them
// further. A drag aims to bring the whole row CLEAR_MARGIN clear of the bar. Undefined when the row is
// taller than the space and no drag can fit it.
export const dragToClear = (row: Rect, top: number, bottom: number) => {
  if (row.height + 2 * CLEAR_MARGIN > bottom - top) return undefined
  const middle = row.y + row.height / 2
  if (middle > bottom - TAP_CLEARANCE) return bottom - CLEAR_MARGIN - (row.y + row.height)
  if (middle < top + TAP_CLEARANCE) return top + CLEAR_MARGIN - row.y
  return 0
}
