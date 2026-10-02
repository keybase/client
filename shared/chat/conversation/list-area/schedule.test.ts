/// <reference types="jest" />
import {makeSchedule} from './schedule'

beforeEach(() => {
  jest.useFakeTimers()
})
afterEach(() => {
  jest.useRealTimers()
})

describe('after', () => {
  test('runs once the delay passes, and is pending until then', () => {
    const schedule = makeSchedule()
    const fn = jest.fn()
    const timer = schedule.after(100, fn)
    jest.advanceTimersByTime(99)
    expect(timer.pending()).toBe(true)
    expect(fn).not.toHaveBeenCalled()
    jest.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(timer.pending()).toBe(false)
  })

  test('cancel drops just that one', () => {
    const schedule = makeSchedule()
    const kept = jest.fn()
    const dropped = jest.fn()
    schedule.after(100, kept)
    const timer = schedule.after(100, dropped)
    timer.cancel()
    expect(timer.pending()).toBe(false)
    jest.advanceTimersByTime(100)
    expect(kept).toHaveBeenCalledTimes(1)
    expect(dropped).not.toHaveBeenCalled()
  })

  test('stop drops every one, and the schedule takes new ones after', () => {
    const schedule = makeSchedule()
    const dropped = jest.fn()
    const later = jest.fn()
    const timer = schedule.after(100, dropped)
    schedule.stop()
    expect(timer.pending()).toBe(false)
    schedule.after(100, later)
    jest.advanceTimersByTime(100)
    expect(dropped).not.toHaveBeenCalled()
    expect(later).toHaveBeenCalledTimes(1)
    expect(jest.getTimerCount()).toBe(0)
  })
})

describe('start', () => {
  const steps: Array<string> = []
  beforeEach(() => {
    steps.length = 0
  })

  test('runs the job up to its first sleep at once, and on after each sleep', async () => {
    const schedule = makeSchedule()
    schedule.start(async sleep => {
      steps.push('first')
      if (!(await sleep(50))) return
      steps.push('second')
    })
    expect(steps).toEqual(['first'])
    await jest.advanceTimersByTimeAsync(50)
    expect(steps).toEqual(['first', 'second'])
  })

  test('stop drops a sleeping job', async () => {
    const schedule = makeSchedule()
    schedule.start(async sleep => {
      if (!(await sleep(50))) return
      steps.push('resumed')
    })
    schedule.stop()
    await jest.advanceTimersByTimeAsync(1000)
    expect(steps).toEqual([])
    expect(jest.getTimerCount()).toBe(0)
  })

  test('a stop between the sleep ending and the job resuming still stops it', async () => {
    const schedule = makeSchedule()
    schedule.start(async sleep => {
      steps.push(`slept ${String(await sleep(50))}`)
    })
    // Both timers fire in one synchronous run, so the stop lands before the job resumes.
    schedule.after(50, () => schedule.stop())
    jest.advanceTimersByTime(50)
    await jest.advanceTimersByTimeAsync(0)
    expect(steps).toEqual(['slept false'])
  })
})
