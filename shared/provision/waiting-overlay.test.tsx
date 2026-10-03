/** @jest-environment jsdom */
/// <reference types="jest" />

import * as React from 'react'
import {act, cleanup, render, screen} from '@testing-library/react'
import {resetAllStores} from '@/util/zustand'
import {useWaitingState} from '@/stores/waiting'
import {waitingKeyProvision} from '@/constants/strings'

const mockPauseProvision = jest.fn()

type BeforeRemoveEvent = {data: {action: {type: string}}}
// The screen's beforeRemove listeners, as the navigator would call them on removal. Each add is its own
// entry, so a listener added twice shows even where both adds pass the same function.
const mockBeforeRemove = new Set<{cb: (e: BeforeRemoveEvent) => void}>()
const mockNavigation = {
  addListener: (type: string, cb: (e: BeforeRemoveEvent) => void) => {
    if (type !== 'beforeRemove') return () => {}
    const entry = {cb}
    mockBeforeRemove.add(entry)
    return () => mockBeforeRemove.delete(entry)
  },
}

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

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
}))

jest.mock('./flow', () => ({
  pauseProvision: (...args: Array<unknown>) => mockPauseProvision(...args),
}))

import {installFakeNavigator, restoreNavigator, type FakeNavigator} from '@/test/fake-navigator'
import ProvisionWaitingOverlay from './waiting-overlay'

// The screen is about to be removed by `type`
const remove = (type: string) => {
  act(() => [...mockBeforeRemove].forEach(({cb}) => cb({data: {action: {type}}})))
}

// `hidden` hides the screen the way native-stack does under other screens: its effects are torn down
const Overlay = ({hidden = false}: {hidden?: boolean}) => (
  <React.Activity mode={hidden ? 'hidden' : 'visible'}>
    <ProvisionWaitingOverlay />
  </React.Activity>
)
// StrictMode renders twice and mounts the effects, unmounts them and mounts them again
const renderOverlay = () => render(<Overlay />, {reactStrictMode: true})

describe('ProvisionWaitingOverlay', () => {
  let nav: FakeNavigator

  beforeEach(() => {
    nav = installFakeNavigator()
    jest.useFakeTimers()
    mockBeforeRemove.clear()
  })

  afterEach(() => {
    restoreNavigator()
    cleanup()
    jest.useRealTimers()
    mockPauseProvision.mockReset()
    // a logout keeps in-flight waiting counts, and some tests end mid-wait
    useWaitingState.getState().dispatch.clear(waitingKeyProvision)
    resetAllStores()
  })

  const startWaiting = () => act(() => useWaitingState.getState().dispatch.increment(waitingKeyProvision))
  const stopWaiting = () => act(() => useWaitingState.getState().dispatch.decrement(waitingKeyProvision))

  test('hidden until 300ms of waiting, cancel affordance at 10s', () => {
    renderOverlay()
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
    renderOverlay()
    startWaiting()
    act(() => jest.advanceTimersByTime(400))
    const box = screen.getByTestId('box2')
    expect(box.getAttribute('data-fullheight')).toBe('true')
    expect(box.getAttribute('data-fullwidth')).toBe('true')
  })

  test('hides and resets when waiting stops', () => {
    renderOverlay()
    startWaiting()
    act(() => jest.advanceTimersByTime(400))
    expect(screen.queryByTestId('spinner')).not.toBeNull()

    stopWaiting()
    expect(screen.queryByTestId('spinner')).toBeNull()
  })

  test('fast RPC never flashes the overlay', () => {
    renderOverlay()
    startWaiting()
    act(() => jest.advanceTimersByTime(100))
    stopWaiting()
    act(() => jest.advanceTimersByTime(1000))
    expect(screen.queryByTestId('spinner')).toBeNull()
  })

  test('cancel pauses the flow and navigates up', () => {
    renderOverlay()
    startWaiting()
    act(() => jest.advanceTimersByTime(10300))

    act(() => screen.getByText('Cancel').click())
    expect(mockPauseProvision).toHaveBeenCalled()
    expect(nav.types()).toContain('GO_BACK')
  })

  test('popping the screen while waiting pauses the flow, once', () => {
    renderOverlay()
    expect(mockBeforeRemove.size).toBe(1)

    remove('POP')
    expect(mockPauseProvision).not.toHaveBeenCalled()

    startWaiting()
    remove('POP')
    expect(mockPauseProvision).toHaveBeenCalledTimes(1)
  })

  test('a native back/swipe dismissal while waiting pauses the flow', () => {
    renderOverlay()
    startWaiting()
    remove('REMOVE')
    expect(mockPauseProvision).toHaveBeenCalledTimes(1)
  })

  // Login success swaps the logged-out root, with this screen, for the logged-in one while the RPC is
  // still finishing; pausing then would cancel it
  test.each(['RESET', 'NAVIGATE', 'REPLACE'])('a removal that is not a back (%s) does not pause', type => {
    renderOverlay()
    startWaiting()
    remove(type)
    expect(mockPauseProvision).not.toHaveBeenCalled()
  })

  // Only a back of the visible screen is the user backing out; a hidden screen goes with a reset or a
  // root swap
  test('a screen hidden under another does not pause when it is removed, and does again once shown', () => {
    const view = renderOverlay()
    startWaiting()
    view.rerender(<Overlay hidden={true} />)
    expect(mockBeforeRemove.size).toBe(0)
    remove('POP')
    expect(mockPauseProvision).not.toHaveBeenCalled()

    view.rerender(<Overlay />)
    expect(mockBeforeRemove.size).toBe(1)
    remove('GO_BACK')
    expect(mockPauseProvision).toHaveBeenCalledTimes(1)
  })
})
