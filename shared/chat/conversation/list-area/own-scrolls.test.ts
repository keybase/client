/// <reference types="jest" />
import {makeOwnScrolls} from './own-scrolls'

beforeEach(() => {
  jest.useFakeTimers()
})
afterEach(() => {
  jest.useRealTimers()
})

const readerAtEnd = {type: 'readerAtEnd'}

describe('the reader moving the list', () => {
  test('takes over at once', () => {
    expect(makeOwnScrolls().readerMoved()).toEqual({type: 'userScrolled'})
  })

  test('coming to rest at the end hands the end back', () => {
    const own = makeOwnScrolls()
    own.readerMoved()
    expect(own.rested(true)).toEqual(readerAtEnd)
  })

  test('coming to rest short of the end hands nothing back', () => {
    const own = makeOwnScrolls()
    own.readerMoved()
    expect(own.rested(false)).toBeUndefined()
  })

  test('one rest settles it: a later rest at the end with no movement in between hands nothing back', () => {
    const own = makeOwnScrolls()
    own.readerMoved()
    own.rested(false)
    expect(own.rested(true)).toBeUndefined()
  })
})

describe('the list scrolling itself', () => {
  test('coming to rest at the end hands nothing back', () => {
    const own = makeOwnScrolls()
    own.issued(0, 500)
    expect(own.rested(true)).toBeUndefined()
  })

  test('nor with no scroll issued: a rest nobody moved to is nobody\'s', () => {
    expect(makeOwnScrolls().rested(true)).toBeUndefined()
  })

  test('its scroll supersedes the reader\'s movement before it: the rest that follows is the list\'s', () => {
    const own = makeOwnScrolls()
    own.readerMoved()
    own.issued(0, 500)
    expect(own.rested(true)).toBeUndefined()
  })

  test('carries movement toward its destination until the list comes to rest', () => {
    const own = makeOwnScrolls()
    expect(own.carries(0, 100)).toBe(false)
    own.issued(0, 500)
    expect(own.carries(0, 100)).toBe(true)
    expect(own.carries(100, 600)).toBe(true)
    own.rested(false)
    expect(own.carries(100, 200)).toBe(false)
  })

  test('or, with no rest reported, for a second', () => {
    const own = makeOwnScrolls()
    own.issued(0, 500)
    jest.advanceTimersByTime(999)
    expect(own.carries(0, 100)).toBe(true)
    jest.advanceTimersByTime(1)
    expect(own.carries(0, 100)).toBe(false)
  })

  test('does not carry movement the other way: that is the reader\'s', () => {
    const own = makeOwnScrolls()
    own.issued(1000, 200)
    expect(own.carries(1000, 600)).toBe(true)
    expect(own.carries(600, 900)).toBe(false)
  })

  test('what heads its way is judged from where each movement starts, so one issued from nowhere known is judged too', () => {
    const own = makeOwnScrolls()
    own.issued(undefined, 200)
    expect(own.carries(1000, 600)).toBe(true)
    expect(own.carries(100, 150)).toBe(true)
    expect(own.carries(100, 50)).toBe(false)
  })

  test('with no destination known, carries any movement', () => {
    const own = makeOwnScrolls()
    own.issued(undefined, undefined)
    expect(own.carries(0, 100)).toBe(true)
    expect(own.carries(100, 0)).toBe(true)
  })

  test('one already where it is going moves nothing and is not in flight', () => {
    const own = makeOwnScrolls()
    own.readerMoved()
    expect(own.issued(300, 300.5)).toBe(false)
    expect(own.carries(300, 400)).toBe(false)
    // Nor does it take over the rest that follows the reader's movement.
    expect(own.rested(true)).toEqual(readerAtEnd)
  })
})
