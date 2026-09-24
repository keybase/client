/** @jest-environment jsdom */
/// <reference types="jest" />
import {act, cleanup, renderHook} from '@testing-library/react'
import {useConfigState} from '@/stores/config'
import {loggedOutScreensDelayMs, useShowLoggedInScreensHeld} from './logged-in-screens'

const setLoggedIn = (loggedIn: boolean) => {
  act(() => {
    useConfigState.setState({loggedIn})
  })
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  cleanup()
  jest.useRealTimers()
  useConfigState.setState({loggedIn: false})
})

test('shows the logged-in screens as soon as the session is logged in', () => {
  const {result} = renderHook(() => useShowLoggedInScreensHeld())
  expect(result.current).toBe(false)

  setLoggedIn(true)
  expect(result.current).toBe(true)
})

test('holds the logged-in screens through a logged-out blip shorter than the delay', () => {
  setLoggedIn(true)
  const {result} = renderHook(() => useShowLoggedInScreensHeld())

  setLoggedIn(false)
  act(() => {
    jest.advanceTimersByTime(loggedOutScreensDelayMs - 1)
  })
  expect(result.current).toBe(true)

  setLoggedIn(true)
  act(() => {
    jest.advanceTimersByTime(loggedOutScreensDelayMs)
  })
  expect(result.current).toBe(true)

  // and the next blip is held from the start too
  setLoggedIn(false)
  expect(result.current).toBe(true)
})

test('shows the logged-out screens once the logout has held for the delay, and again after a later blip', () => {
  setLoggedIn(true)
  const {result} = renderHook(() => useShowLoggedInScreensHeld())

  setLoggedIn(false)
  act(() => {
    jest.advanceTimersByTime(loggedOutScreensDelayMs)
  })
  expect(result.current).toBe(false)

  setLoggedIn(true)
  setLoggedIn(false)
  expect(result.current).toBe(true)
  act(() => {
    jest.advanceTimersByTime(loggedOutScreensDelayMs)
  })
  expect(result.current).toBe(false)
})
