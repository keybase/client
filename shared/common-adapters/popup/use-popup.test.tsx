/** @jest-environment jsdom */
/// <reference types="jest" />

import * as React from 'react'
import {act, cleanup, renderHook} from '@testing-library/react'
import {usePopup2, type Popup2Parms} from './use-popup'

type MutableGlobals = {isMobile: boolean}
const g = globalThis as unknown as MutableGlobals

// the hook debounces toggles within 100ms of each other
const tooQuick = 100

describe('usePopup2', () => {
  let now = 0
  beforeEach(() => {
    now = 100000
    jest.spyOn(Date, 'now').mockImplementation(() => now)
  })
  afterEach(() => {
    cleanup()
    jest.restoreAllMocks()
    g.isMobile = false
  })

  const advance = (ms: number) => {
    now += ms
  }

  const makePopup = () => React.createElement('div', null, 'popup')

  test('starts hidden with no popup node', () => {
    const {result} = renderHook(() => usePopup2(makePopup))
    expect(result.current.showingPopup).toBe(false)
    expect(result.current.popup).toBeNull()
  })

  test('showPopup renders the popup', () => {
    const {result} = renderHook(() => usePopup2(makePopup))
    act(() => {
      result.current.showPopup()
    })
    expect(result.current.showingPopup).toBe(true)
    expect(result.current.popup).not.toBeNull()
  })

  test('a second toggle inside the debounce window is dropped', () => {
    const {result} = renderHook(() => usePopup2(makePopup))
    act(() => {
      result.current.showPopup()
    })
    advance(tooQuick - 1)
    act(() => {
      result.current.hidePopup()
    })
    expect(result.current.showingPopup).toBe(true)
  })

  test('a toggle after the debounce window lands', () => {
    const {result} = renderHook(() => usePopup2(makePopup))
    act(() => {
      result.current.showPopup()
    })
    advance(tooQuick)
    act(() => {
      result.current.hidePopup()
    })
    expect(result.current.showingPopup).toBe(false)
    expect(result.current.popup).toBeNull()
  })

  test('togglePopup flips between show and hide', () => {
    const {result} = renderHook(() => usePopup2(makePopup))
    act(() => {
      result.current.togglePopup()
    })
    expect(result.current.showingPopup).toBe(true)
    advance(tooQuick)
    act(() => {
      result.current.togglePopup()
    })
    expect(result.current.showingPopup).toBe(false)
  })

  test('show/hide identities stay stable across renders so callers can memoize on them', () => {
    const {result, rerender} = renderHook(() => usePopup2(makePopup))
    const {showPopup, hidePopup, popupAnchor} = result.current
    rerender()
    expect(result.current.showPopup).toBe(showPopup)
    expect(result.current.hidePopup).toBe(hidePopup)
    expect(result.current.popupAnchor).toBe(popupAnchor)
  })

  test('desktop passes the anchor ref to makePopup, mobile does not', () => {
    const parms: Array<Popup2Parms> = []
    const spyMake = (p: Popup2Parms) => {
      parms.push(p)
      return makePopup()
    }
    g.isMobile = false
    const desktop = renderHook(() => usePopup2(spyMake))
    act(() => {
      desktop.result.current.showPopup()
    })
    expect(parms[0]?.attachTo).toBe(desktop.result.current.popupAnchor)

    parms.length = 0
    g.isMobile = true
    const mobile = renderHook(() => usePopup2(spyMake))
    act(() => {
      mobile.result.current.showPopup()
    })
    expect(parms[0]?.attachTo).toBeUndefined()
  })

  test('a new makePopup identity re-renders the popup contents while showing', () => {
    const first = () => React.createElement('div', null, 'first')
    const second = () => React.createElement('div', null, 'second')
    const {result, rerender} = renderHook(({make}: {make: () => React.ReactElement}) => usePopup2(make), {
      initialProps: {make: first},
    })
    act(() => {
      result.current.showPopup()
    })
    expect((result.current.popup as React.ReactElement<{children: string}>).props.children).toBe('first')
    rerender({make: second})
    expect((result.current.popup as React.ReactElement<{children: string}>).props.children).toBe('second')
  })
})
