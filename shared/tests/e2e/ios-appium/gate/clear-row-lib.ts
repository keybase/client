import type {Rect} from './header-button-lib'

// Breathing room kept between a row and the bar it was dragged clear of.
export const CLEAR_MARGIN = 8

// How far to drag a list's content (negative = up) so `row` lies wholly between `top` (the safe
// area's and nav bar's bottom) and `bottom` (the floating tab bar's top, or the screen's bottom).
// 0 when it already does; undefined when the row is taller than the space and no drag can fit it.
export const dragToClear = (row: Rect, top: number, bottom: number) => {
  if (row.height + 2 * CLEAR_MARGIN > bottom - top) return undefined
  const rowBottom = row.y + row.height
  if (rowBottom > bottom - CLEAR_MARGIN) return bottom - CLEAR_MARGIN - rowBottom
  if (row.y < top + CLEAR_MARGIN) return top + CLEAR_MARGIN - row.y
  return 0
}
