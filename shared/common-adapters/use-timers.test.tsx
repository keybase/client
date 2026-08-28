/** @jest-environment jsdom */
/// <reference types="jest" />

import * as React from 'react'
import {act, cleanup, renderHook} from '@testing-library/react'
import {useInterval, useTimeout} from './use-timers'

describe('useTimeout', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    cleanup()
    jest.useRealTimers()
  })

  test('does not fire until started', () => {
    const cb = jest.fn()
    renderHook(() => useTimeout(cb, 100))
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(cb).not.toHaveBeenCalled()
  })

  test('fires once after the timing elapses', () => {
    const cb = jest.fn()
    const {result} = renderHook(() => useTimeout(cb, 100))
    act(() => {
      result.current()
      jest.advanceTimersByTime(99)
    })
    expect(cb).not.toHaveBeenCalled()
    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(cb).toHaveBeenCalledTimes(1)
  })

  test('restarting before it fires extends the pending timer', () => {
    const cb = jest.fn()
    const {result} = renderHook(() => useTimeout(cb, 100))
    act(() => {
      result.current()
      jest.advanceTimersByTime(60)
      result.current()
      jest.advanceTimersByTime(40)
    })
    // the first timer was cancelled by the restart, so nothing has fired yet
    expect(cb).not.toHaveBeenCalled()
    act(() => {
      jest.advanceTimersByTime(60)
    })
    expect(cb).toHaveBeenCalledTimes(1)
  })

  test('starting again after it fired schedules a fresh timer', () => {
    const cb = jest.fn()
    const {result} = renderHook(() => useTimeout(cb, 100))
    act(() => {
      result.current()
      jest.advanceTimersByTime(100)
    })
    expect(cb).toHaveBeenCalledTimes(1)
    act(() => {
      result.current()
      jest.advanceTimersByTime(100)
    })
    expect(cb).toHaveBeenCalledTimes(2)
  })

  test('calls the latest callback, not the one captured at start time', () => {
    const first = jest.fn()
    const second = jest.fn()
    const {result, rerender} = renderHook(({cb}: {cb: () => void}) => useTimeout(cb, 100), {
      initialProps: {cb: first},
    })
    act(() => {
      result.current()
    })
    rerender({cb: second})
    act(() => {
      jest.advanceTimersByTime(100)
    })
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  test('unmounting cancels a pending timer', () => {
    const cb = jest.fn()
    const {result, unmount} = renderHook(() => useTimeout(cb, 100))
    act(() => {
      result.current()
    })
    unmount()
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(cb).not.toHaveBeenCalled()
  })
  test('the returned starter keeps one identity across renders', () => {
    const seen: Array<() => void> = []
    const {rerender} = renderHook(
      ({cb}) => {
        seen.push(useTimeout(cb, 100))
      },
      {initialProps: {cb: () => {}}}
    )
    rerender({cb: () => {}})
    rerender({cb: () => {}})
    expect(seen).toHaveLength(3)
    expect(seen[1]).toBe(seen[0])
    expect(seen[2]).toBe(seen[0])
  })

  test('a caller that starts the timer from an effect is not restarted by a render', () => {
    // this is how profile-card, verify-body and alphabet-index use it: an
    // unstable starter identity re-runs the effect and resets the timer
    const cb = jest.fn()
    const {rerender} = renderHook(
      ({fn}) => {
        const start = useTimeout(fn, 100)
        React.useEffect(() => {
          start()
        }, [start])
      },
      {initialProps: {fn: cb}}
    )
    act(() => {
      jest.advanceTimersByTime(60)
    })
    rerender({fn: cb})
    act(() => {
      jest.advanceTimersByTime(60)
    })
    expect(cb).toHaveBeenCalledTimes(1)
  })
})

describe('useInterval', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    cleanup()
    jest.useRealTimers()
  })

  test('fires repeatedly', () => {
    const cb = jest.fn()
    renderHook(() => useInterval(cb, 50))
    act(() => {
      jest.advanceTimersByTime(160)
    })
    expect(cb).toHaveBeenCalledTimes(3)
  })

  test('an undefined interval never schedules anything', () => {
    const cb = jest.fn()
    renderHook(() => useInterval(cb, undefined))
    act(() => {
      jest.advanceTimersByTime(10000)
    })
    expect(cb).not.toHaveBeenCalled()
  })

  test('changing the callback does not restart the interval', () => {
    const first = jest.fn()
    const second = jest.fn()
    const {rerender} = renderHook(({cb}: {cb: () => void}) => useInterval(cb, 50), {
      initialProps: {cb: first},
    })
    act(() => {
      jest.advanceTimersByTime(40)
    })
    rerender({cb: second})
    act(() => {
      jest.advanceTimersByTime(10)
    })
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  test('changing the interval restarts the timer', () => {
    const cb = jest.fn()
    const {rerender} = renderHook(({ms}: {ms: number}) => useInterval(cb, ms), {initialProps: {ms: 50}})
    act(() => {
      jest.advanceTimersByTime(40)
    })
    rerender({ms: 100})
    act(() => {
      jest.advanceTimersByTime(60)
    })
    expect(cb).not.toHaveBeenCalled()
    act(() => {
      jest.advanceTimersByTime(40)
    })
    expect(cb).toHaveBeenCalledTimes(1)
  })

  test('unmounting clears the interval', () => {
    const cb = jest.fn()
    const {unmount} = renderHook(() => useInterval(cb, 50))
    act(() => {
      jest.advanceTimersByTime(50)
    })
    expect(cb).toHaveBeenCalledTimes(1)
    unmount()
    act(() => {
      jest.advanceTimersByTime(500)
    })
    expect(cb).toHaveBeenCalledTimes(1)
  })
})
