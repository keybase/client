import {CLEAR_MARGIN, TAP_CLEARANCE, dragToClear} from './clear-row-lib'

const row = {height: 50, width: 400, x: 0, y: 300}
const top = 120
const bottom = 780

test('a row wholly between the bars needs no drag', () => {
  expect(dragToClear(row, top, bottom)).toBe(0)
  expect(dragToClear({...row, y: bottom - CLEAR_MARGIN - 50}, top, bottom)).toBe(0)
})

test('a row whose middle is under the tab bar is dragged up until it ends above the bar', () => {
  expect(dragToClear({...row, y: 770}, top, bottom)).toBe(-(770 + 50 - (bottom - CLEAR_MARGIN)))
  expect(dragToClear({...row, y: bottom - 25}, top, bottom)).toBeLessThan(0)
})

test('a row whose middle is too near the tab bar is dragged', () => {
  expect(dragToClear({...row, y: bottom - 25 - TAP_CLEARANCE + 1}, top, bottom)).toBeLessThan(0)
})

test('a last row partly under the tab bar, its middle clear of it, is clear', () => {
  expect(dragToClear({...row, y: bottom - 25 - TAP_CLEARANCE}, top, bottom)).toBe(0)
})

test("a row right under the nav bar, as a list's first row sits, is clear; one whose middle is under it is dragged down", () => {
  expect(dragToClear({...row, y: top}, top, bottom)).toBe(0)
  expect(dragToClear({...row, y: 100}, top, bottom)).toBe(top + CLEAR_MARGIN - 100)
})

test('a row too tall for the space between the bars fits nowhere', () => {
  expect(dragToClear({...row, height: 700}, top, bottom)).toBeUndefined()
})
