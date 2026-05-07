/** @jest-environment jsdom */
/// <reference types="jest" />

import {afterEach, beforeEach, expect, jest, test} from '@jest/globals'
import {act, cleanup, renderHook} from '@testing-library/react'
import {useDebouncedCallback, useThrottledCallback} from './use-debounce'

const advance = (ms: number) => {
  act(() => {
    jest.advanceTimersByTime(ms)
  })
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  jest.useRealTimers()
})

test('useDebouncedCallback delays calls until the trailing edge by default', () => {
  const callback = jest.fn((value: string) => `done:${value}`)
  const {result} = renderHook(() => useDebouncedCallback(callback, 100))

  let returnValue: string | undefined
  act(() => {
    returnValue = result.current('alpha')
  })

  expect(returnValue).toBeUndefined()
  expect(callback).not.toHaveBeenCalled()

  advance(99)
  expect(callback).not.toHaveBeenCalled()

  advance(1)
  expect(callback).toHaveBeenCalledTimes(1)
  expect(callback).toHaveBeenCalledWith('alpha')
})

test('useDebouncedCallback with leading true does not fire an extra trailing call for a single invocation', () => {
  const callback = jest.fn((value: string) => `done:${value}`)
  const {result} = renderHook(() => useDebouncedCallback(callback, 100, {leading: true}))

  let returnValue: string | undefined
  act(() => {
    returnValue = result.current('alpha')
  })

  expect(returnValue).toBe('done:alpha')
  expect(callback).toHaveBeenCalledTimes(1)
  expect(callback).toHaveBeenCalledWith('alpha')

  advance(100)
  expect(callback).toHaveBeenCalledTimes(1)
  expect(result.current.isPending()).toBe(false)
})

test('useDebouncedCallback supports combined leading and trailing behavior', () => {
  const callback = jest.fn((value: string) => `done:${value}`)
  const {result} = renderHook(() =>
    useDebouncedCallback(callback, 100, {leading: true, trailing: true})
  )

  act(() => {
    result.current('alpha')
  })
  advance(50)
  act(() => {
    result.current('beta')
  })

  expect(callback).toHaveBeenCalledTimes(1)
  expect(callback).toHaveBeenNthCalledWith(1, 'alpha')

  advance(99)
  expect(callback).toHaveBeenCalledTimes(1)

  advance(1)
  expect(callback).toHaveBeenCalledTimes(2)
  expect(callback).toHaveBeenNthCalledWith(2, 'beta')
})

test('useDebouncedCallback respects trailing false', () => {
  const callback = jest.fn((value: string) => `done:${value}`)
  const {result} = renderHook(() =>
    useDebouncedCallback(callback, 100, {leading: true, trailing: false})
  )

  act(() => {
    result.current('alpha')
  })
  advance(50)
  act(() => {
    result.current('beta')
  })

  advance(100)
  expect(callback).toHaveBeenCalledTimes(1)
  expect(callback).toHaveBeenCalledWith('alpha')

  act(() => {
    result.current('gamma')
  })
  expect(callback).toHaveBeenCalledTimes(2)
  expect(callback).toHaveBeenNthCalledWith(2, 'gamma')
})

test('useDebouncedCallback cancel clears pending work', () => {
  const callback = jest.fn((value: string) => `done:${value}`)
  const {result} = renderHook(() => useDebouncedCallback(callback, 100))

  act(() => {
    result.current('alpha')
  })
  expect(result.current.isPending()).toBe(true)

  act(() => {
    result.current.cancel()
  })

  expect(result.current.isPending()).toBe(false)
  advance(100)
  expect(callback).not.toHaveBeenCalled()
})

test('useDebouncedCallback flush runs pending work immediately', () => {
  const callback = jest.fn((value: string) => `done:${value}`)
  const {result} = renderHook(() => useDebouncedCallback(callback, 100))

  act(() => {
    result.current('alpha')
  })

  let flushed: string | undefined
  act(() => {
    flushed = result.current.flush()
  })

  expect(flushed).toBe('done:alpha')
  expect(callback).toHaveBeenCalledTimes(1)
  expect(callback).toHaveBeenCalledWith('alpha')
  expect(result.current.isPending()).toBe(false)
})

test('useDebouncedCallback uses the latest callback after rerender', () => {
  const first = jest.fn((value: string) => `first:${value}`)
  const second = jest.fn((value: string) => `second:${value}`)
  const {result, rerender} = renderHook(
    ({callback}: {callback: (value: string) => string}) => useDebouncedCallback(callback, 100),
    {initialProps: {callback: first}}
  )

  act(() => {
    result.current('alpha')
  })
  rerender({callback: second})

  advance(100)
  expect(first).not.toHaveBeenCalled()
  expect(second).toHaveBeenCalledTimes(1)
  expect(second).toHaveBeenCalledWith('alpha')
})

test('useDebouncedCallback returns the last invocation result on later calls', () => {
  const callback = jest.fn(() => 42)
  const {result} = renderHook(() => useDebouncedCallback(callback, 100))

  let firstReturn: number | undefined
  act(() => {
    firstReturn = result.current()
  })
  expect(firstReturn).toBeUndefined()

  advance(100)
  expect(callback).toHaveBeenCalledTimes(1)

  let secondReturn: number | undefined
  act(() => {
    secondReturn = result.current()
  })
  expect(secondReturn).toBe(42)
})

test('useThrottledCallback defaults to leading and trailing calls without dropping cooldown after a trailing invoke', () => {
  const callback = jest.fn((value: string) => `done:${value}`)
  const {result} = renderHook(() => useThrottledCallback(callback, 100))

  let firstReturn: string | undefined
  act(() => {
    firstReturn = result.current('alpha')
  })
  expect(firstReturn).toBe('done:alpha')
  expect(callback).toHaveBeenCalledTimes(1)
  expect(callback).toHaveBeenNthCalledWith(1, 'alpha')

  advance(50)
  let secondReturn: string | undefined
  act(() => {
    secondReturn = result.current('beta')
  })
  expect(secondReturn).toBe('done:alpha')

  advance(50)
  expect(callback).toHaveBeenCalledTimes(2)
  expect(callback).toHaveBeenNthCalledWith(2, 'beta')

  advance(50)
  act(() => {
    result.current('gamma')
  })
  expect(callback).toHaveBeenCalledTimes(2)

  advance(50)
  expect(callback).toHaveBeenCalledTimes(3)
  expect(callback).toHaveBeenNthCalledWith(3, 'gamma')
})

test('useThrottledCallback supports trailing false', () => {
  const callback = jest.fn((value: string) => `done:${value}`)
  const {result} = renderHook(() =>
    useThrottledCallback(callback, 100, {trailing: false})
  )

  act(() => {
    result.current('alpha')
  })
  advance(50)
  act(() => {
    result.current('beta')
  })

  advance(50)
  expect(callback).toHaveBeenCalledTimes(1)
  expect(callback).toHaveBeenNthCalledWith(1, 'alpha')

  advance(50)
  act(() => {
    result.current('gamma')
  })
  expect(callback).toHaveBeenCalledTimes(2)
  expect(callback).toHaveBeenNthCalledWith(2, 'gamma')
})

test('useThrottledCallback supports leading false', () => {
  const callback = jest.fn((value: string) => `done:${value}`)
  const {result} = renderHook(() =>
    useThrottledCallback(callback, 100, {leading: false, trailing: true})
  )

  act(() => {
    result.current('alpha')
  })
  expect(callback).not.toHaveBeenCalled()

  advance(50)
  act(() => {
    result.current('beta')
  })
  expect(callback).not.toHaveBeenCalled()

  advance(50)
  expect(callback).toHaveBeenCalledTimes(1)
  expect(callback).toHaveBeenNthCalledWith(1, 'beta')
})

test('useThrottledCallback collapses repeated calls within the wait window to the latest args', () => {
  const callback = jest.fn((value: string) => `done:${value}`)
  const {result} = renderHook(() => useThrottledCallback(callback, 100))

  act(() => {
    result.current('alpha')
  })
  advance(25)
  act(() => {
    result.current('beta')
  })
  advance(25)
  act(() => {
    result.current('gamma')
  })

  advance(50)
  expect(callback).toHaveBeenCalledTimes(2)
  expect(callback).toHaveBeenNthCalledWith(2, 'gamma')
})
