/** @jest-environment jsdom */
/// <reference types="jest" />
import {act, cleanup, renderHook} from '@testing-library/react'
import {
  clearSignupEmail,
  getSignupEmail,
  setSignupEmail,
  subscribeToSignupEmail,
  useSignupEmail,
} from './signup-email'

afterEach(() => {
  cleanup()
  clearSignupEmail()
})

test('setSignupEmail is readable synchronously and pushes to subscribed hooks', () => {
  const {result} = renderHook(() => useSignupEmail())
  expect(result.current).toBe('')

  act(() => {
    setSignupEmail('testuser@example.com')
  })

  expect(getSignupEmail()).toBe('testuser@example.com')
  expect(result.current).toBe('testuser@example.com')
})

test('clearSignupEmail empties the banner state for every subscriber', () => {
  const {result} = renderHook(() => useSignupEmail())
  act(() => {
    setSignupEmail('testuser@example.com')
  })
  act(() => {
    clearSignupEmail()
  })

  expect(getSignupEmail()).toBe('')
  expect(result.current).toBe('')
})

// useSyncExternalStore bails out on an unchanged snapshot, so counting renders
// would pass with or without the equality guards; listen to the store directly
test('setting the same email again does not notify subscribers', () => {
  const listener = jest.fn()
  const unsub = subscribeToSignupEmail(listener)

  setSignupEmail('testuser@example.com')
  expect(listener).toHaveBeenCalledTimes(1)

  setSignupEmail('testuser@example.com')
  expect(listener).toHaveBeenCalledTimes(1)
  unsub()
})

test('clearing an already empty email does not notify subscribers', () => {
  const listener = jest.fn()
  const unsub = subscribeToSignupEmail(listener)

  clearSignupEmail()
  expect(listener).not.toHaveBeenCalled()

  setSignupEmail('testuser@example.com')
  clearSignupEmail()
  expect(listener).toHaveBeenCalledTimes(2)
  unsub()
})

test('unmounted hooks stop receiving updates', () => {
  const {result, unmount} = renderHook(() => useSignupEmail())
  act(() => {
    setSignupEmail('one@example.com')
  })
  expect(result.current).toBe('one@example.com')

  unmount()
  act(() => {
    setSignupEmail('two@example.com')
  })
  expect(result.current).toBe('one@example.com')
  expect(getSignupEmail()).toBe('two@example.com')
})

test('every mounted subscriber sees the same value', () => {
  const a = renderHook(() => useSignupEmail())
  const b = renderHook(() => useSignupEmail())

  act(() => {
    setSignupEmail('testuser@example.com')
  })

  expect(a.result.current).toBe('testuser@example.com')
  expect(b.result.current).toBe('testuser@example.com')
})
