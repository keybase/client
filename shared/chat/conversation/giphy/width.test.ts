/// <reference types="jest" />
import {getMargins, scaledWidth} from './width'

// getMargins works on scaled widths and hands back the margin to subtract from
// each one: minWidth 100, maxWidth 200. Expected margins below are the literal
// pixel results, so a change in the packing algorithm shows up here.

test('scaledWidth halves the reported gif width', () => {
  expect(scaledWidth(300)).toBe(150)
  expect(scaledWidth(0)).toBe(0)
})

test('no gifs means no margins', () => {
  expect(getMargins(320, [])).toEqual([])
})

test('every gif gets exactly one margin', () => {
  const widths = [300, 300, 300, 300, 210, 210, 210]
  expect(getMargins(320, widths)).toEqual([44, 44, 42, 30, 5, 5, 0])
})

test('a row that already fits is left fully expanded', () => {
  expect(getMargins(320, [200, 200, 200])).toEqual([0, 0, 0])
})

test('a row wider than the display compresses to exactly the display width', () => {
  // 150 - 44, 150 - 44, 150 - 42 = 320; the leftover gif starts the next row uncompressed
  expect(getMargins(320, [300, 300, 300, 300])).toEqual([44, 44, 42, 0])
})

test('gifs are never compressed below the minimum width', () => {
  // eight 105px gifs can never be squeezed into 320, so none of them is compressed at all
  expect(getMargins(320, [210, 210, 210, 210, 210, 210, 210, 210])).toEqual([0, 0, 0, 0, 0, 0, 0, 0])
})

test('an uncompressable row hands the last gif back to the next row', () => {
  // 4x105 cannot reach 320 without going under the 100 minimum, so the row is cut
  // at three and the fourth gif restarts the scan alongside the two 150s
  expect(getMargins(320, [210, 210, 210, 210, 300, 300])).toEqual([0, 0, 0, 5, 40, 40])
})

test('very wide gifs are clamped down so a pair still fits the row', () => {
  // 500 clamps to 200, then compresses to 160 each
  expect(getMargins(320, [1000, 1000])).toEqual([340, 340])
})

test('the trailing row is allowed to expand back past the max width clamp', () => {
  // a lone 300px-scaled gif is clamped to 200 while rows are being formed, but the
  // final expand pass hands it the whole row back
  expect(getMargins(320, [600])).toEqual([0])
})
