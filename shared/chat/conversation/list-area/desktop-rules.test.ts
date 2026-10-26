/// <reference types="jest" />
import {
  listMovedItself,
  offsetFromMiddle,
  pageOffset,
  revealDestination,
  rowWithinView,
  atEnd,
} from './desktop-rules'

describe('atEnd', () => {
  test('within two pixels of the end is at the end', () => {
    expect(atEnd(0)).toBe(true)
    expect(atEnd(2)).toBe(true)
    expect(atEnd(3)).toBe(false)
  })
})

describe('offsetFromMiddle', () => {
  test('is how far the row middle sits below the view middle', () => {
    expect(offsetFromMiddle({height: 40, top: 280}, {height: 600, top: 0})).toBe(0)
    expect(offsetFromMiddle({height: 40, top: 380}, {height: 600, top: 0})).toBe(100)
    expect(offsetFromMiddle({height: 40, top: 130}, {height: 600, top: 50})).toBe(-200)
  })
})

describe('rowWithinView', () => {
  const view = {height: 600, top: 100}
  test('a row inside the view, or overhanging it by a pixel, is within it', () => {
    expect(rowWithinView({height: 50, top: 100}, view, 0)).toBe(true)
    expect(rowWithinView({height: 50, top: 651}, view, 0)).toBe(true)
    expect(rowWithinView({height: 50, top: 99}, view, 0)).toBe(true)
  })
  test('a row overhanging either edge by more is not', () => {
    expect(rowWithinView({height: 50, top: 652}, view, 0)).toBe(false)
    expect(rowWithinView({height: 50, top: 98}, view, 0)).toBe(false)
  })
  test('is judged with the scroller moved down by the shift', () => {
    expect(rowWithinView({height: 50, top: 700}, view, 100)).toBe(true)
    expect(rowWithinView({height: 50, top: 150}, view, 100)).toBe(false)
  })
})

describe('listMovedItself', () => {
  const moved = (from: number, now: number, listScroll: number, maxScroll = 10000) =>
    listMovedItself({from, listScroll, maxScroll, now})
  test('landing on or between where the scroller was and where the list put it is the list', () => {
    expect(moved(100, 300, 300)).toBe(true)
    expect(moved(100, 200, 300)).toBe(true)
    expect(moved(300, 100, 100)).toBe(true)
  })
  test('within a pixel either side of that span is the list', () => {
    expect(moved(100, 301, 300)).toBe(true)
    expect(moved(100, 99, 300)).toBe(true)
  })
  test('anywhere else is not', () => {
    expect(moved(100, 302, 300)).toBe(false)
    expect(moved(100, 50, 300)).toBe(false)
    // The list wrote nothing new down: any movement off where it was is someone else's.
    expect(moved(100, 150, 100)).toBe(false)
  })
  test('a destination past the scroller extent counts only as far as the extent', () => {
    expect(moved(100, 500, 800, 500)).toBe(true)
    expect(moved(100, 600, 800, 500)).toBe(false)
  })
})

describe('revealDestination', () => {
  test('a measured row heads for the middle, within the scroll range', () => {
    expect(revealDestination({from: 500, max: 2000, offBy: 150, rowBeforeRendered: false})).toBe(650)
    expect(revealDestination({from: 100, max: 2000, offBy: -300, rowBeforeRendered: false})).toBe(0)
    expect(revealDestination({from: 1900, max: 2000, offBy: 300, rowBeforeRendered: true})).toBe(2000)
  })
  test('a row not rendered heads for the end of the thread on its side', () => {
    expect(revealDestination({from: 500, max: 2000, offBy: undefined, rowBeforeRendered: true})).toBe(0)
    expect(revealDestination({from: 500, max: 2000, offBy: undefined, rowBeforeRendered: false})).toBe(2000)
  })
})

describe('pageOffset', () => {
  test('pages a viewport either way, never above the top', () => {
    expect(pageOffset('up', {scroll: 1000, scrollLength: 400})).toBe(600)
    expect(pageOffset('up', {scroll: 100, scrollLength: 400})).toBe(0)
    expect(pageOffset('down', {scroll: 1000, scrollLength: 400})).toBe(1400)
  })
})
