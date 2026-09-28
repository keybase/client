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
    own.issued()
    expect(own.rested(true)).toBeUndefined()
  })

  test('nor with no scroll issued: a rest nobody moved to is nobody\'s', () => {
    expect(makeOwnScrolls().rested(true)).toBeUndefined()
  })

  test('its scroll supersedes the reader\'s movement before it: the rest that follows is the list\'s', () => {
    const own = makeOwnScrolls()
    own.readerMoved()
    own.issued()
    expect(own.rested(true)).toBeUndefined()
  })

  test('is in flight until the list comes to rest', () => {
    const own = makeOwnScrolls()
    expect(own.ownInFlight()).toBe(false)
    own.issued()
    expect(own.ownInFlight()).toBe(true)
    own.rested(false)
    expect(own.ownInFlight()).toBe(false)
  })

  test('or, with no rest reported, for a second', () => {
    const own = makeOwnScrolls()
    own.issued()
    jest.advanceTimersByTime(999)
    expect(own.ownInFlight()).toBe(true)
    jest.advanceTimersByTime(1)
    expect(own.ownInFlight()).toBe(false)
  })
})
