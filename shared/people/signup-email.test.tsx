/** @jest-environment jsdom */
/// <reference types="jest" />
import {act, cleanup, renderHook} from '@testing-library/react'
import {clearSignupEmail, getSignupEmail, setSignupEmail, useSignupEmail} from './signup-email'

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

test('setting the same email again does not notify subscribers', () => {
  let renders = 0
  renderHook(() => {
    renders++
    return useSignupEmail()
  })
  act(() => {
    setSignupEmail('testuser@example.com')
  })
  const afterFirstSet = renders

  act(() => {
    setSignupEmail('testuser@example.com')
  })
  expect(renders).toBe(afterFirstSet)
})

test('clearing an already empty email does not notify subscribers', () => {
  let renders = 0
  renderHook(() => {
    renders++
    return useSignupEmail()
  })
  const before = renders

  act(() => {
    clearSignupEmail()
  })
  expect(renders).toBe(before)
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
