/** @jest-environment jsdom */
/// <reference types="jest" />

import {act, cleanup, renderHook} from '@testing-library/react'
import {useDelayedShow} from './use-delayed-show'

beforeEach(() => {
  jest.useFakeTimers()
})
afterEach(() => {
  cleanup()
  jest.useRealTimers()
})

test('stays hidden until the delay passes', () => {
  const {result} = renderHook(() => useDelayedShow(true, 1000))
  expect(result.current).toBe(false)
  act(() => {
    jest.advanceTimersByTime(999)
  })
  expect(result.current).toBe(false)
  act(() => {
    jest.advanceTimersByTime(1)
  })
  expect(result.current).toBe(true)
})

test('never shows when the wait ends before the delay', () => {
  const {result, rerender} = renderHook(({want}) => useDelayedShow(want, 1000), {initialProps: {want: true}})
  act(() => {
    jest.advanceTimersByTime(500)
  })
  rerender({want: false})
  act(() => {
    jest.advanceTimersByTime(2000)
  })
  expect(result.current).toBe(false)
})

test('hides at once when the wait ends, and waits the full delay on the next one', () => {
  const {result, rerender} = renderHook(({want}) => useDelayedShow(want, 1000), {initialProps: {want: true}})
  act(() => {
    jest.advanceTimersByTime(1000)
  })
  expect(result.current).toBe(true)
  rerender({want: false})
  expect(result.current).toBe(false)
  rerender({want: true})
  expect(result.current).toBe(false)
  act(() => {
    jest.advanceTimersByTime(1000)
  })
  expect(result.current).toBe(true)
})

test('a zero delay shows on the first render', () => {
  const {result} = renderHook(() => useDelayedShow(true, 0))
  expect(result.current).toBe(true)
})
