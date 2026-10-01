/// <reference types="jest" />
import {
  atRestingEnd,
  correctorStep,
  isAppend,
  itemScrollHeading,
  readerMovedList,
  rowUncovered,
  type ScrollReport,
} from './native-rules'

describe('atRestingEnd', () => {
  test('within eight points above the resting offset, or below it, is at the end', () => {
    expect(atRestingEnd(0, 0)).toBe(true)
    expect(atRestingEnd(8, 0)).toBe(true)
    expect(atRestingEnd(9, 0)).toBe(false)
    expect(atRestingEnd(-300, -300)).toBe(true)
    expect(atRestingEnd(-291, -300)).toBe(false)
    expect(atRestingEnd(-400, -300)).toBe(true)
  })
})

describe('rowUncovered', () => {
  test('with nothing covering the list, a row inside the view (or a point past either edge) is in view', () => {
    const at = {offset: 1000, resting: 0, viewport: 600}
    expect(rowUncovered({height: 100, y: 999}, at)).toBe(true)
    expect(rowUncovered({height: 100, y: 1501}, at)).toBe(true)
    expect(rowUncovered({height: 100, y: 998}, at)).toBe(false)
    expect(rowUncovered({height: 100, y: 1502}, at)).toBe(false)
  })
  test('the keyboard covers the bottom of the view by as much as the resting offset sits below 0', () => {
    const at = {offset: 1000, resting: -300, viewport: 600}
    expect(rowUncovered({height: 100, y: 1299}, at)).toBe(true)
    expect(rowUncovered({height: 100, y: 1200}, at)).toBe(false)
  })
})

describe('readerMovedList', () => {
  const report = (offset: number, p: Partial<ScrollReport> = {}): ScrollReport => ({
    content: 5000,
    offset,
    resting: 0,
    ...p,
  })
  const moved = (
    last: ScrollReport | undefined,
    now: ScrollReport,
    p: {carried?: boolean; ownsEnd?: boolean} = {}
  ) => readerMovedList(last, now, {carried: () => p.carried ?? false, ownsEnd: p.ownsEnd ?? false})

  test('movement the list did not make is the reader', () => {
    expect(moved(report(100), report(300))).toBe(true)
  })
  test('the first report, and movement under a point, is not', () => {
    expect(moved(undefined, report(300))).toBe(false)
    expect(moved(report(100), report(100.5))).toBe(false)
  })
  test('movement with the content or the resting offset changing is the list', () => {
    expect(moved(report(100), report(300, {content: 5200}))).toBe(false)
    expect(moved(report(100), report(300, {resting: -300}))).toBe(false)
  })
  test('a scroll of the list own in flight carries it', () => {
    expect(moved(report(100), report(300), {carried: true})).toBe(false)
  })
  test('while the list owns the end, moving toward it is its anchor, and moving away is the reader', () => {
    expect(moved(report(300), report(100), {ownsEnd: true})).toBe(false)
    expect(moved(report(100), report(300), {ownsEnd: true})).toBe(true)
    expect(moved(report(300), report(100))).toBe(true)
  })
  test('asks whether a scroll carries the movement only when nothing else explains it', () => {
    const carried = jest.fn(() => false)
    readerMovedList(report(100), report(300, {content: 5200}), {carried, ownsEnd: false})
    readerMovedList(undefined, report(300), {carried, ownsEnd: false})
    expect(carried).not.toHaveBeenCalled()
    readerMovedList(report(100), report(300), {carried, ownsEnd: false})
    expect(carried).toHaveBeenCalledTimes(1)
  })
})

describe('itemScrollHeading', () => {
  const base = {first: 10, frame: undefined, index: 30, last: 20, lift: 0, offset: 1000, viewport: 600}
  test('without a lift, only which way the row lies from the middle of the rows in view is known', () => {
    expect(itemScrollHeading(base)).toBe(Infinity)
    expect(itemScrollHeading({...base, index: 15})).toBe(Infinity)
    expect(itemScrollHeading({...base, index: 14})).toBe(-Infinity)
  })
  test('with nothing in view reported, or the row not loaded, it is not known', () => {
    expect(itemScrollHeading({...base, first: null})).toBeUndefined()
    expect(itemScrollHeading({...base, last: undefined})).toBeUndefined()
    expect(itemScrollHeading({...base, index: -1})).toBeUndefined()
  })
  test('a lifted row the list has laid out lands with its middle at the middle of the view, raised by the lift', () => {
    const frame = {height: 100, y: 2000}
    expect(itemScrollHeading({...base, frame, lift: 150})).toBe(2000 + (100 - 600) / 2 - 150)
  })
  test('a lifted row not laid out falls back to which way it lies', () => {
    expect(itemScrollHeading({...base, index: 5, lift: 150})).toBe(-Infinity)
    expect(itemScrollHeading({...base, frame: {height: 100, y: 2000}, lift: 150, viewport: undefined})).toBe(Infinity)
  })
})

describe('correctorStep', () => {
  const base = {
    content: 10000,
    first: 10,
    iters: 0,
    last: 20,
    offset: 2000,
    resting: 0,
    rows: 100,
    targetIndex: 30,
    viewport: 800,
  }
  test('a target within half a row of the middle of the rows in view is settled', () => {
    expect(correctorStep({...base, targetIndex: 15})).toEqual({type: 'settle'})
    expect(correctorStep({...base, targetIndex: 15.5})).toEqual({type: 'settle'})
  })
  test('steps toward the target by the row distance at the average row height, damped by 0.9', () => {
    // 15 rows older at 100 each, damped: 1350 further from the end.
    expect(correctorStep(base)).toEqual({offset: 3350, type: 'step'})
    expect(correctorStep({...base, targetIndex: 5})).toEqual({offset: 1100, type: 'step'})
  })
  test('thirteen steps are the whole budget', () => {
    expect(correctorStep({...base, iters: 12})).toEqual({offset: 3350, type: 'step'})
    expect(correctorStep({...base, iters: 13})).toEqual({type: 'settle'})
  })
  test('waits for the list to report its size and offset', () => {
    expect(correctorStep({...base, content: undefined})).toEqual({type: 'wait'})
    expect(correctorStep({...base, offset: undefined})).toEqual({type: 'wait'})
    expect(correctorStep({...base, viewport: undefined})).toEqual({type: 'wait'})
  })
  test('a step is clamped to the scrollable range, and one that would move nothing settles', () => {
    expect(correctorStep({...base, offset: 9000})).toEqual({offset: 9200, type: 'step'})
    expect(correctorStep({...base, offset: 9200})).toEqual({type: 'settle'})
    expect(correctorStep({...base, offset: 100, targetIndex: 0})).toEqual({offset: 0, type: 'step'})
    expect(correctorStep({...base, offset: -250, resting: -250, targetIndex: 0})).toEqual({type: 'settle'})
  })
})

describe('isAppend', () => {
  const base = {heldLatest: true, newest: 11, previousNewest: 10, sameDataset: true}
  test('a newer newest row in the same dataset, held at the newest, is an append', () => {
    expect(isAppend(base)).toBe(true)
  })
  test('anything else is not', () => {
    expect(isAppend({...base, newest: 10})).toBe(false)
    expect(isAppend({...base, newest: 9})).toBe(false)
    expect(isAppend({...base, sameDataset: false})).toBe(false)
    expect(isAppend({...base, heldLatest: false})).toBe(false)
    expect(isAppend({...base, previousNewest: undefined})).toBe(false)
    expect(isAppend({...base, newest: undefined})).toBe(false)
  })
})
