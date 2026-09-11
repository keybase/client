/** @jest-environment jsdom */
/// <reference types="jest" />
import {getLoopInterval, makeInitialTimerState, syncTimerState} from './exploding-meta'
import {formatDurationShort} from '@/util/timestamp'

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

  test('wakes when the rounded-up display next drops a unit', () => {
    // a fresh 24h fuse reads 24h until 23h are left
    expect(getLoopInterval(day - 1)).toBe(hour - 1)
    expect(getLoopInterval(23 * hour + 20 * minute)).toBe(20 * minute)
    expect(getLoopInterval(day + 8 * hour)).toBe(8 * hour)
    expect(getLoopInterval(90 * second)).toBe(30 * second)
    expect(getLoopInterval(100 * second)).toBe(40 * second)
  })

  test('on an exact boundary it waits a whole unit', () => {
    expect(getLoopInterval(2 * hour)).toBe(hour)
    expect(getLoopInterval(3 * day)).toBe(day)
  })

  test('above a minute it never asks for sub-second ticks', () => {
    // a timer that fires a hair early lands just past a boundary
    expect(getLoopInterval(hour + 1)).toBe(second)
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
      explodesAt: now + hour,
      inter: 0,
      mode: 'none',
      now,
    })
  })

  test('an already exploded message is hidden', () => {
    expect(makeInitialTimerState({exploded: true, explodesAt: now + hour, pending: false})).toEqual({
      exploded: true,
      explodesAt: now + hour,
      inter: 0,
      mode: 'hidden',
      now,
    })
  })

  test('a message past its explode time is hidden', () => {
    expect(makeInitialTimerState({exploded: false, explodesAt: now - 1, pending: false})).toEqual({
      exploded: false,
      explodesAt: now - 1,
      inter: 0,
      mode: 'hidden',
      now,
    })
  })

  test('a live message counts down on the loop interval', () => {
    expect(makeInitialTimerState({exploded: false, explodesAt: now + 90 * second, pending: false})).toEqual({
      exploded: false,
      explodesAt: now + 90 * second,
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

describe('syncTimerState', () => {
  const t0 = 1_700_000_000_000
  let clock = t0

  beforeEach(() => {
    clock = t0
    jest.spyOn(Date, 'now').mockImplementation(() => clock)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('unchanged props keep the same state', () => {
    const p = {exploded: false, explodesAt: t0 + day - 50, pending: false}
    const s = makeInitialTimerState(p)
    clock += 2 * second
    expect(syncTimerState(s, p)).toBe(s)
  })

  test('a later explodesAt from a re-unbox is measured from the current time', () => {
    // the service stamps a fresh receive time on every unbox, so a reload can push a
    // just-sent 24h message's explodesAt a little later than it was when the row mounted
    const s = makeInitialTimerState({exploded: false, explodesAt: t0 + day - 50, pending: false})
    expect(formatDurationShort(s.explodesAt - s.now)).toBe('24h')
    clock += 2 * second
    const next = syncTimerState(s, {exploded: false, explodesAt: t0 + day + 1500, pending: false})
    expect(next.now).toBe(clock)
    expect(next.mode).toBe('countdown')
    expect(formatDurationShort(next.explodesAt - next.now)).toBe('24h')
  })

  test('exploding goes to boom even if explodesAt moved with it', () => {
    const s = makeInitialTimerState({exploded: false, explodesAt: t0 + hour, pending: false})
    const next = syncTimerState(s, {exploded: true, explodesAt: t0, pending: false})
    expect(next.mode).toBe('boom')
    expect(next.inter).toBe(0)
    expect(syncTimerState(next, {exploded: true, explodesAt: t0, pending: false})).toBe(next)
  })

  test('a countdown that reached boom is not reset by a moved explodesAt', () => {
    const s = {...makeInitialTimerState({exploded: false, explodesAt: t0 + second, pending: false}), mode: 'boom' as const}
    expect(syncTimerState(s, {exploded: false, explodesAt: t0 + 2 * second, pending: false})).toBe(s)
  })
})
