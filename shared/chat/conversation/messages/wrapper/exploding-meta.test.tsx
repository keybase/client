/** @jest-environment jsdom */
/// <reference types="jest" />
import {getLoopInterval, makeInitialTimerState} from './exploding-meta'

const second = 1000
const minute = 60 * second
const hour = 60 * minute
const day = 24 * hour

describe('getLoopInterval', () => {
  test('under a minute it ticks twice a second', () => {
    expect(getLoopInterval(0)).toBe(500)
    expect(getLoopInterval(30 * second)).toBe(500)
    expect(getLoopInterval(minute)).toBe(500)
  })

  test('within half a unit of the boundary it wakes exactly on the boundary', () => {
    // the remainder is returned so the displayed unit flips on time
    expect(getLoopInterval(70 * second)).toBe(10 * second)
    expect(getLoopInterval(90 * second)).toBe(30 * second)
    expect(getLoopInterval(hour + 20 * minute)).toBe(20 * minute)
    expect(getLoopInterval(day + 8 * hour)).toBe(8 * hour)
  })

  test('further into a unit it wakes on the next half-unit mark', () => {
    // 100s = 1m40s; past the half-minute mark, so wake 10s later at 1m30s
    expect(getLoopInterval(100 * second)).toBe(10 * second)
    // exactly 2 units in: half a unit until the next half mark
    expect(getLoopInterval(2 * hour)).toBe(hour / 2)
    expect(getLoopInterval(3 * day)).toBe(day / 2)
  })
})

describe('makeInitialTimerState', () => {
  const now = 1_700_000_000_000

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(now)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('a pending send shows nothing yet', () => {
    expect(makeInitialTimerState({exploded: false, explodesAt: now + hour, pending: true})).toEqual({
      exploded: false,
      inter: 0,
      mode: 'none',
      now,
    })
  })

  test('an already exploded message is hidden', () => {
    expect(makeInitialTimerState({exploded: true, explodesAt: now + hour, pending: false})).toEqual({
      exploded: true,
      inter: 0,
      mode: 'hidden',
      now,
    })
  })

  test('a message past its explode time is hidden', () => {
    expect(makeInitialTimerState({exploded: false, explodesAt: now - 1, pending: false})).toEqual({
      exploded: false,
      inter: 0,
      mode: 'hidden',
      now,
    })
  })

  test('a live message counts down on the loop interval', () => {
    expect(makeInitialTimerState({exploded: false, explodesAt: now + 90 * second, pending: false})).toEqual({
      exploded: false,
      inter: minute / 2,
      mode: 'countdown',
      now,
    })
  })

  test('the countdown interval is capped at a minute for long fuses', () => {
    const {inter, mode} = makeInitialTimerState({
      exploded: false,
      explodesAt: now + 7 * day,
      pending: false,
    })
    expect(mode).toBe('countdown')
    expect(inter).toBe(minute)
  })
})
