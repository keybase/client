/** @jest-environment jsdom */
/// <reference types="jest" />

import {act, cleanup, renderHook} from '@testing-library/react'

jest.mock('@/constants', () => ({
  Router2: {
    // react-navigation's useFocusEffect re-runs when the callback identity changes
    useSafeFocusEffect: (cb: () => (() => void) | undefined) => require('react').useEffect(cb, [cb]),
  },
}))
jest.mock('@/constants/platform', () => ({isMac: true}))

import {useHotKey} from './hot-key'

type MutableGlobals = {isMobile: boolean}
const g = globalThis as unknown as MutableGlobals

type KeyInit = {
  key: string
  metaKey?: boolean
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  target?: Element
}

const press = ({key, target, ...mods}: KeyInit) => {
  const event = new KeyboardEvent('keydown', {bubbles: true, cancelable: true, key, ...mods})
  act(() => {
    ;(target ?? document.body).dispatchEvent(event)
  })
  return event
}

describe('useHotKey', () => {
  afterEach(() => {
    cleanup()
    g.isMobile = false
  })

  test('fires the callback with the combo that matched', () => {
    const cb = jest.fn()
    renderHook(() => useHotKey(['mod+k'], cb))
    press({key: 'k', metaKey: true})
    expect(cb).toHaveBeenCalledWith('mod+k')
  })

  test('a matched key is prevented and stopped', () => {
    renderHook(() => useHotKey(['mod+k'], jest.fn()))
    const event = press({key: 'k', metaKey: true})
    expect(event.defaultPrevented).toBe(true)
  })

  test('an unmatched key is left alone', () => {
    const cb = jest.fn()
    renderHook(() => useHotKey(['mod+k'], cb))
    const event = press({key: 'j', metaKey: true})
    expect(cb).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  test('mod requires meta on mac and rejects a bare key', () => {
    const cb = jest.fn()
    renderHook(() => useHotKey(['mod+k'], cb))
    press({key: 'k'})
    press({key: 'k', ctrlKey: true})
    expect(cb).not.toHaveBeenCalled()
  })

  test('modifier state must match exactly for non-mod combos', () => {
    const cb = jest.fn()
    renderHook(() => useHotKey(['esc'], cb))
    press({key: 'Escape', shiftKey: true})
    expect(cb).not.toHaveBeenCalled()
    press({key: 'Escape'})
    expect(cb).toHaveBeenCalledTimes(1)
  })

  test('aliases map onto real key names', () => {
    const cases: ReadonlyArray<[string, string]> = [
      ['esc', 'Escape'],
      ['left', 'ArrowLeft'],
      ['right', 'ArrowRight'],
      ['up', 'ArrowUp'],
      ['down', 'ArrowDown'],
      ['space', ' '],
    ]
    for (const [combo, key] of cases) {
      const cb = jest.fn()
      const {unmount} = renderHook(() => useHotKey([combo], cb))
      press({key})
      expect(cb).toHaveBeenCalledWith(combo)
      unmount()
    }
  })

  test('key matching is case insensitive', () => {
    const cb = jest.fn()
    renderHook(() => useHotKey(['mod+K'], cb))
    press({key: 'K', metaKey: true})
    expect(cb).toHaveBeenCalledTimes(1)
  })

  test('a string of comma separated keys registers each one', () => {
    const cb = jest.fn()
    renderHook(() => useHotKey('esc,mod+k', cb))
    press({key: 'Escape'})
    press({key: 'k', metaKey: true})
    expect(cb.mock.calls.map(c => c[0])).toEqual(['esc', 'mod+k'])
  })

  test('the most recently mounted listener wins (LIFO)', () => {
    const first = jest.fn()
    const second = jest.fn()
    renderHook(() => useHotKey(['esc'], first))
    const later = renderHook(() => useHotKey(['esc'], second))
    press({key: 'Escape'})
    expect(second).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()
    later.unmount()
    press({key: 'Escape'})
    expect(first).toHaveBeenCalledTimes(1)
  })

  test('unmounting removes the listener', () => {
    const cb = jest.fn()
    const {unmount} = renderHook(() => useHotKey(['esc'], cb))
    unmount()
    press({key: 'Escape'})
    expect(cb).not.toHaveBeenCalled()
  })

  test('the latest callback is used without re-registering', () => {
    const first = jest.fn()
    const second = jest.fn()
    const {rerender} = renderHook(({cb}: {cb: () => void}) => useHotKey(['esc'], cb), {
      initialProps: {cb: first},
    })
    rerender({cb: second})
    press({key: 'Escape'})
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  test('typing in an input does not trigger hot keys', () => {
    const cb = jest.fn()
    renderHook(() => useHotKey(['esc'], cb))
    const input = document.createElement('input')
    document.body.appendChild(input)
    press({key: 'Escape', target: input})
    expect(cb).not.toHaveBeenCalled()
    input.remove()
  })

  test('inputs opted in with data-allow-keyboard-shortcuts still trigger hot keys', () => {
    const cb = jest.fn()
    renderHook(() => useHotKey(['esc'], cb))
    const input = document.createElement('input')
    input.setAttribute('data-allow-keyboard-shortcuts', 'true')
    document.body.appendChild(input)
    press({key: 'Escape', target: input})
    expect(cb).toHaveBeenCalledTimes(1)
    input.remove()
  })

  test('an empty key list registers nothing', () => {
    const cb = jest.fn()
    renderHook(() => useHotKey([], cb))
    press({key: 'Escape'})
    expect(cb).not.toHaveBeenCalled()
  })

  test('mobile is a no-op', () => {
    g.isMobile = true
    const cb = jest.fn()
    renderHook(() => useHotKey(['esc'], cb))
    press({key: 'Escape'})
    expect(cb).not.toHaveBeenCalled()
  })

  test('re-rendering an older listener with a fresh inline array does not steal the key', () => {
    const first = jest.fn()
    const second = jest.fn()
    // keys is a new array literal on every render, mirroring how callers pass it
    const older = renderHook(({k}: {k: string}) => useHotKey([k], first), {initialProps: {k: 'esc'}})
    renderHook(() => useHotKey(['esc'], second))
    older.rerender({k: 'esc'})
    press({key: 'Escape'})
    expect(second).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()
  })
})
