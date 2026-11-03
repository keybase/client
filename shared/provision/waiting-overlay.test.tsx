/** @jest-environment jsdom */
/// <reference types="jest" />

import type * as React from 'react'
import {act, cleanup, screen} from '@testing-library/react'
import {CommonActions, StackActions} from '@react-navigation/core'
import {navigationRef} from '@/constants/navigator'
import {resetAllStores} from '@/util/zustand'
import {useWaitingState} from '@/stores/waiting'
import {waitingKeyProvision} from '@/constants/strings'

const mockPauseProvision = jest.fn()

jest.mock('@/common-adapters', () => {
  const React = require('react')
  return {
    Box2: ({children, fullHeight, fullWidth}: {children?: React.ReactNode; fullHeight?: boolean; fullWidth?: boolean}) =>
      React.createElement('div', {'data-fullheight': fullHeight, 'data-fullwidth': fullWidth, 'data-testid': 'box2'}, children),
    Button: ({label, onClick}: {label?: string; onClick?: () => void}) =>
      React.createElement('button', {onClick, type: 'button'}, label),
    ProgressIndicator: () => React.createElement('div', {'data-testid': 'spinner'}),
    Styles: {
      createStyleHook: <T,>(styles: (theme: unknown) => T) => () => styles({white_75: '#ffffffbf'}),
      globalStyles: {fillAbsolute: {}},
      useTheme: () => ({white_75: '#ffffffbf'}),
    },
    Text: ({children}: {children?: React.ReactNode}) => React.createElement('span', null, children),
  }
})

jest.mock('./flow', () => ({
  pauseProvision: (...args: Array<unknown>) => mockPauseProvision(...args),
}))

import {installNavigation, makeRootState, stackKeyOf, type InstalledNavigation} from '@/test/navigation'
import ProvisionWaitingOverlay from './waiting-overlay'

describe('ProvisionWaitingOverlay', () => {
  let nav: InstalledNavigation

  // The overlay as provisioning shows it: inside the code page, a route of the logged-out stack.
  const render = () => {
    nav = installNavigation({
      rootState: makeRootState({above: [{name: 'codePage'}], loggedIn: false}),
      screen: r => (r.name === 'codePage' ? <ProvisionWaitingOverlay /> : null),
    })
  }

  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    nav.unmount()
    cleanup()
    jest.useRealTimers()
    mockPauseProvision.mockReset()
    // a logout keeps in-flight waiting counts, and some tests end mid-wait
    useWaitingState.getState().dispatch.clear(waitingKeyProvision)
    resetAllStores()
  })

  const startWaiting = () => act(() => useWaitingState.getState().dispatch.increment(waitingKeyProvision))
  const stopWaiting = () => act(() => useWaitingState.getState().dispatch.decrement(waitingKeyProvision))
  const codePage = () => nav.getRootState()?.routes?.[0]?.state?.routes.find(r => r.name === 'codePage')
  const dispatch = (action: Parameters<typeof navigationRef.dispatch>[0]) => act(() => navigationRef.dispatch(action))
  test('hidden until 300ms of waiting, cancel affordance at 10s', () => {
    render()
    expect(screen.queryByTestId('spinner')).toBeNull()

    startWaiting()
    act(() => jest.advanceTimersByTime(299))
    expect(screen.queryByTestId('spinner')).toBeNull()

    act(() => jest.advanceTimersByTime(1))
    expect(screen.queryByTestId('spinner')).not.toBeNull()
    expect(screen.queryByText('Cancel')).toBeNull()

    act(() => jest.advanceTimersByTime(10000))
    expect(screen.queryByText('Cancel')).not.toBeNull()
  })

  test('overlay box fills its container (desktop Box2 centers abspos children otherwise)', () => {
    render()
    startWaiting()
    act(() => jest.advanceTimersByTime(400))
    const box = screen.getByTestId('box2')
    expect(box.getAttribute('data-fullheight')).toBe('true')
    expect(box.getAttribute('data-fullwidth')).toBe('true')
  })

  test('hides and resets when waiting stops', () => {
    render()
    startWaiting()
    act(() => jest.advanceTimersByTime(400))
    expect(screen.queryByTestId('spinner')).not.toBeNull()

    stopWaiting()
    expect(screen.queryByTestId('spinner')).toBeNull()
  })

  test('fast RPC never flashes the overlay', () => {
    render()
    startWaiting()
    act(() => jest.advanceTimersByTime(100))
    stopWaiting()
    act(() => jest.advanceTimersByTime(1000))
    expect(screen.queryByTestId('spinner')).toBeNull()
  })

  test('cancel pauses the flow and navigates up', () => {
    render()
    startWaiting()
    act(() => jest.advanceTimersByTime(10300))

    act(() => screen.getByText('Cancel').click())
    expect(mockPauseProvision).toHaveBeenCalled()
    expect(nav.types()).toContain('GO_BACK')
    expect(codePage()).toBeUndefined()
  })

  test('popping the screen while waiting pauses the flow', () => {
    render()
    startWaiting()
    dispatch(StackActions.pop())
    expect(codePage()).toBeUndefined()
    expect(mockPauseProvision).toHaveBeenCalled()
  })

  test('popping the screen when not waiting does not pause', () => {
    render()
    dispatch(StackActions.pop())
    expect(codePage()).toBeUndefined()
    expect(mockPauseProvision).not.toHaveBeenCalled()
  })

  test('going back while waiting pauses the flow', () => {
    render()
    startWaiting()
    dispatch(CommonActions.goBack())
    expect(codePage()).toBeUndefined()
    expect(mockPauseProvision).toHaveBeenCalled()
  })

  // native-stack's onDismissed dispatches this for a native back or swipe
  test('a native back/swipe dismissal while waiting pauses the flow', () => {
    render()
    startWaiting()
    dispatch({...StackActions.dismiss(), source: codePage()?.key, target: stackKeyOf('codePage')})
    expect(codePage()).toBeUndefined()
    expect(mockPauseProvision).toHaveBeenCalled()
  })

  test('a non-back removal (e.g. login success unmounting the stack) does not pause', () => {
    render()
    startWaiting()
    const rs = nav.getRootState()!
    dispatch(
      CommonActions.reset({
        ...rs,
        index: 0,
        routes: [{...rs.routes![0]!, state: {index: 0, routes: [{key: 'login-0', name: 'login'}]}}],
      } as never)
    )
    expect(codePage()).toBeUndefined()
    expect(mockPauseProvision).not.toHaveBeenCalled()
  })
})
