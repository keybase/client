/// <reference types="jest" />
import {getMargins, scaledWidth} from './width'

// getMargins works on scaled widths: minWidth 100, maxWidth 200.
const widthsFor = (margins: ReadonlyArray<number>, widths: ReadonlyArray<number>) =>
  margins.map((margin, idx) => scaledWidth(widths[idx]!) - margin)

test('scaledWidth halves the reported gif width', () => {
  expect(scaledWidth(300)).toBe(150)
  expect(scaledWidth(0)).toBe(0)
})

test('no gifs means no margins', () => {
  expect(getMargins(320, [])).toEqual([])
})

test('every gif gets exactly one margin', () => {
  const widths = [300, 300, 300, 300, 210, 210, 210]
  expect(getMargins(320, widths)).toHaveLength(widths.length)
})

test('a row that already fits is left fully expanded', () => {
  expect(getMargins(320, [200, 200, 200])).toEqual([0, 0, 0])
})

test('a row wider than the display compresses to exactly the display width', () => {
  const widths = [300, 300, 300, 300]
  const margins = getMargins(320, widths)
  const rowWidths = widthsFor(margins.slice(0, 3), widths)
  expect(rowWidths.reduce((a, b) => a + b, 0)).toBe(320)
  // the leftover gif starts the next row and stays uncompressed
  expect(margins[3]).toBe(0)
})

test('gifs are never compressed below the minimum width', () => {
  const widths = [210, 210, 210, 210, 210, 210, 210, 210]
  const margins = getMargins(320, widths)
  widthsFor(margins, widths).forEach(w => {
    expect(w).toBeGreaterThanOrEqual(100)
  })
})

test('very wide gifs are clamped down so a pair still fits the row', () => {
  const widths = [1000, 1000]
  const margins = getMargins(320, widths)
  expect(widthsFor(margins, widths)).toEqual([160, 160])
})

test('the trailing row is allowed to expand back past the max width clamp', () => {
  // a lone 300px-scaled gif is clamped to 200 while rows are being formed, but the
  // final expand pass hands it the whole row back
  expect(getMargins(320, [600])).toEqual([0])
})
