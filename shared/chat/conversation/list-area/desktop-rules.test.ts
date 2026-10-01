/// <reference types="jest" />
import {
  listMovedItself,
  offsetFromMiddle,
  pageOffset,
  revealDestination,
  rowWithinView,
  scrollerAtEnd,
  startCenterCheck,
  startEndCheck,
  stepCentering,
  stepEndCheck,
  stepLayoutCheck,
  type CenterCheck,
  type CenterStep,
  type EndCheck,
  type LayoutCheck,
} from './desktop-rules'

describe('scrollerAtEnd', () => {
  const scroller = (scrollTop: number) => ({clientHeight: 500, scrollHeight: 2000, scrollTop})
  test('within two pixels of the end is at the end', () => {
    expect(scrollerAtEnd(scroller(1500))).toBe(true)
    expect(scrollerAtEnd(scroller(1498))).toBe(true)
    expect(scrollerAtEnd(scroller(1497))).toBe(false)
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

// Feeds looks through a step function and records each action.
const run = <C, L, R extends {check: C}, P>(
  step: (c: C, l: L) => R,
  start: C,
  looks: Array<L>,
  pick: (r: R) => P
): Array<P> => {
  let check = start
  return looks.map(look => {
    const next = step(check, look)
    check = next.check
    return pick(next)
  })
}

describe('stepEndCheck', () => {
  type Look = {atEnd: boolean; scroll: number; scrollHeight: number}
  const at = (scrollHeight: number): Look => ({atEnd: true, scroll: 0, scrollHeight})
  const off = (scroll: number): Look => ({atEnd: false, scroll, scrollHeight: 2000})
  const actions = (looks: Array<Look>, start: EndCheck = startEndCheck) =>
    run(stepEndCheck, start, looks, a => a.action)

  test('the end holds at the end on two looks running with the content no taller', () => {
    expect(actions([at(2000), at(2000)])).toEqual(['wait', 'held'])
  })
  test('content still growing at the end is looked at again', () => {
    expect(actions([at(2000), at(2100), at(2100)])).toEqual(['wait', 'wait', 'held'])
  })
  test('away from the end, the list is corrected only once its offset held still', () => {
    expect(actions([off(100), off(200), off(200)])).toEqual(['wait', 'wait', 'correct'])
  })
  test('a correction starts the stillness over', () => {
    expect(actions([off(100), off(100), off(100), off(100)])).toEqual(['wait', 'correct', 'wait', 'correct'])
  })
  test('two corrections are the whole budget', () => {
    expect(actions([off(1), off(1), off(1), off(1), off(1), off(1)])).toEqual([
      'wait',
      'correct',
      'wait',
      'correct',
      'wait',
      'giveUp',
    ])
  })
  test('leaving the end between looks forgets the height it held at', () => {
    expect(actions([at(2000), off(100), at(2000), at(2000)])).toEqual(['wait', 'wait', 'wait', 'held'])
  })
})

describe('stepCentering', () => {
  type Look = [offBy: number | undefined, scroll: number | undefined]
  const steps = (looks: Array<Look>, start: CenterCheck = startCenterCheck): Array<CenterStep> =>
    run((c: CenterCheck, [offBy, scroll]: Look) => stepCentering(c, offBy, scroll), start, looks, a => a.step)
  const wait: CenterStep = {type: 'wait'}
  const done: CenterStep = {type: 'done'}
  const mount: CenterStep = {type: 'mount'}
  const scrollTo = (offset: number): CenterStep => ({offset, type: 'scrollTo'})

  test('a row not rendered is mounted first', () => {
    expect(steps([[undefined, 0]])).toEqual([mount])
  })
  test('a row off the middle is scrolled there, and one within eight pixels three times is done', () => {
    expect(steps([[200, 1000], [8, 1200], [-8, 1200], [0, 1200]])).toEqual([scrollTo(1200), wait, wait, done])
    expect(steps([[9, 1000]])).toEqual([scrollTo(1009)])
  })
  test('an unknown scroll offset counts as centred', () => {
    expect(steps([[200, undefined], [200, undefined], [200, undefined]])).toEqual([wait, wait, done])
  })
  test('a correction that moved nothing three times running is pinned against an edge', () => {
    expect(steps([[200, 0], [200, 0], [200, 0], [200, 0]])).toEqual([scrollTo(200), wait, wait, done])
  })
  test('the centred count carries across corrections, and is reset only by the row unmounting', () => {
    expect(steps([[0, 0], [0, 0], [100, 0], [0, 100]])).toEqual([wait, wait, scrollTo(100), done])
    expect(steps([[0, 0], [0, 0], [undefined, undefined], [0, 0]])).toEqual([wait, wait, mount, wait])
  })
  test('a centred look forgets the last correction, so it cannot count toward a pin', () => {
    expect(steps([[100, 0], [0, 100], [100, 100], [100, 100]])).toEqual([scrollTo(100), wait, scrollTo(200), wait])
  })
})

describe('stepLayoutCheck', () => {
  type Look = {changes: number; scroll: number | undefined}
  const settles = (looks: Array<Look>) => {
    const start: LayoutCheck = {previousChanges: 0, previousScroll: undefined, quiet: 0}
    return run(stepLayoutCheck, start, looks, a => a.settled)
  }
  test('settles once the offset and the row changes held still across two looks running', () => {
    expect(settles([{changes: 0, scroll: 10}, {changes: 0, scroll: 10}, {changes: 0, scroll: 10}])).toEqual([
      false,
      false,
      true,
    ])
  })
  test('a row change or a scroll starts the stillness over', () => {
    expect(
      settles([
        {changes: 0, scroll: 10},
        {changes: 0, scroll: 10},
        {changes: 1, scroll: 10},
        {changes: 1, scroll: 20},
        {changes: 1, scroll: 20},
        {changes: 1, scroll: 20},
      ])
    ).toEqual([false, false, false, false, false, true])
  })
  test('an unknown offset never settles', () => {
    expect(settles([{changes: 0, scroll: undefined}, {changes: 0, scroll: undefined}, {changes: 0, scroll: undefined}])).toEqual([
      false,
      false,
      false,
    ])
  })
})
