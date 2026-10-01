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
    own.issued(0, 500, false)
    expect(own.rested(true)).toBeUndefined()
  })

  test('nor with no scroll issued: a rest nobody moved to is nobody\'s', () => {
    expect(makeOwnScrolls().rested(true)).toBeUndefined()
  })

  test('its scroll supersedes the reader\'s movement before it: the rest that follows is the list\'s', () => {
    const own = makeOwnScrolls()
    own.readerMoved()
    own.issued(0, 500, false)
    expect(own.rested(true)).toBeUndefined()
  })

  test('carries movement toward its destination until the list comes to rest', () => {
    const own = makeOwnScrolls()
    expect(own.carries(0, 100)).toBe(false)
    own.issued(0, 500, false)
    expect(own.carries(0, 100)).toBe(true)
    expect(own.carries(100, 200)).toBe(true)
    own.rested(false)
    expect(own.carries(200, 300)).toBe(false)
  })

  test('an instant one is done once it arrives: movement after it, even back its way, is the reader\'s', () => {
    const own = makeOwnScrolls()
    own.issued(0, 500, false)
    expect(own.carries(0, 500)).toBe(true)
    expect(own.carries(500, 700)).toBe(false)
    expect(own.carries(700, 600)).toBe(false)
  })

  test('an instant one carried past its destination is done too', () => {
    const own = makeOwnScrolls()
    own.issued(0, 500, false)
    expect(own.carries(0, 520)).toBe(true)
    expect(own.carries(520, 510)).toBe(false)
  })

  test('one that knows only which way it heads is done when the list comes to rest', () => {
    const own = makeOwnScrolls()
    own.issued(0, Infinity, false)
    expect(own.carries(0, 5000)).toBe(true)
    expect(own.carries(5000, 9000)).toBe(true)
    expect(own.carries(9000, 8000)).toBe(false)
    own.rested(false)
    expect(own.carries(8000, 9000)).toBe(false)
  })

  test('or, with no rest reported, for a second', () => {
    const own = makeOwnScrolls()
    own.issued(0, 500, false)
    jest.advanceTimersByTime(999)
    expect(own.carries(0, 100)).toBe(true)
    jest.advanceTimersByTime(1)
    expect(own.carries(0, 100)).toBe(false)
  })

  test('does not carry movement the other way: that is the reader\'s', () => {
    const own = makeOwnScrolls()
    own.issued(1000, 200, false)
    expect(own.carries(1000, 600)).toBe(true)
    expect(own.carries(600, 900)).toBe(false)
  })

  test('what heads its way is judged from where each movement starts, so one issued from nowhere known is judged too', () => {
    const own = makeOwnScrolls()
    own.issued(undefined, 200, false)
    expect(own.carries(1000, 600)).toBe(true)
    expect(own.carries(100, 150)).toBe(true)
    expect(own.carries(100, 50)).toBe(false)
  })

  // Where an animated scroll lands is measured before it starts, and the list's own layout can move
  // it: all of its movement its way is its own until it comes to rest.
  test('an animated one carries its movement past where it was measured to land, until it comes to rest', () => {
    const own = makeOwnScrolls()
    own.issued(5000, 1200, true)
    expect(own.carries(5000, 1200)).toBe(true)
    expect(own.carries(1200, 1100)).toBe(true)
    expect(own.carries(1100, 1300)).toBe(false)
    own.rested(false)
    expect(own.carries(1100, 1000)).toBe(false)
  })

  test('an animated one goes on for as long as its animation, up to three seconds', () => {
    const own = makeOwnScrolls()
    own.issued(5000, 1200, true)
    jest.advanceTimersByTime(2999)
    expect(own.carries(3000, 2000)).toBe(true)
    jest.advanceTimersByTime(1)
    expect(own.carries(2000, 1500)).toBe(false)
  })

  test('one already where it is going moves nothing and is not in flight', () => {
    const own = makeOwnScrolls()
    own.readerMoved()
    expect(own.issued(300, 300.5, false)).toBe(false)
    expect(own.carries(300, 400)).toBe(false)
    // Nor does it take over the rest that follows the reader's movement.
    expect(own.rested(true)).toEqual(readerAtEnd)
  })
})
