/** @jest-environment jsdom */
/// <reference types="jest" />

import type * as React from 'react'
import {act, cleanup, render, screen} from '@testing-library/react'
import {resetAllStores} from '@/util/zustand'
import {useWaitingState} from '@/stores/waiting'
import {waitingKeyProvision} from '@/constants/strings'

const mockPauseProvision = jest.fn()
const mockNavigateUp = jest.fn()
const mockAddListener = jest.fn()

jest.mock('@/common-adapters', () => {
  const React = require('react')
  return {
    Box2: ({children, fullHeight, fullWidth}: {children?: React.ReactNode; fullHeight?: boolean; fullWidth?: boolean}) =>
      React.createElement('div', {'data-fullheight': fullHeight, 'data-fullwidth': fullWidth, 'data-testid': 'box2'}, children),
    Button: ({label, onClick}: {label?: string; onClick?: () => void}) =>
      React.createElement('button', {onClick, type: 'button'}, label),
    ProgressIndicator: () => React.createElement('div', {'data-testid': 'spinner'}),
    Styles: {
      globalColors: {white_75: '#ffffffbf'},
      globalStyles: {fillAbsolute: {}},
      styleSheetCreate: <T,>(styles: () => T) => styles(),
    },
    Text: ({children}: {children?: React.ReactNode}) => React.createElement('span', null, children),
  }
})

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({addListener: mockAddListener}),
}))

jest.mock('@/constants/router', () => ({
  navigateUp: (...args: Array<unknown>) => mockNavigateUp(...args),
}))

jest.mock('./flow', () => ({
  pauseProvision: (...args: Array<unknown>) => mockPauseProvision(...args),
}))

import ProvisionWaitingOverlay from './waiting-overlay'

type BeforeRemoveEvent = {data: {action: {type: string}}}

describe('ProvisionWaitingOverlay', () => {
  let beforeRemove: undefined | ((e: BeforeRemoveEvent) => void)

  beforeEach(() => {
    jest.useFakeTimers()
    beforeRemove = undefined
    mockAddListener.mockImplementation((event: string, callback: (e: BeforeRemoveEvent) => void) => {
      if (event === 'beforeRemove') {
        beforeRemove = callback
      }
      return jest.fn()
    })
  })

  afterEach(() => {
    cleanup()
    jest.useRealTimers()
    mockAddListener.mockReset()
    mockPauseProvision.mockReset()
    mockNavigateUp.mockReset()
    resetAllStores()
  })

  const startWaiting = () => act(() => useWaitingState.getState().dispatch.increment(waitingKeyProvision))
  const stopWaiting = () => act(() => useWaitingState.getState().dispatch.decrement(waitingKeyProvision))

  test('hidden until 300ms of waiting, cancel affordance at 10s', () => {
    render(<ProvisionWaitingOverlay />)
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
    render(<ProvisionWaitingOverlay />)
    startWaiting()
    act(() => jest.advanceTimersByTime(400))
    const box = screen.getByTestId('box2')
    expect(box.getAttribute('data-fullheight')).toBe('true')
    expect(box.getAttribute('data-fullwidth')).toBe('true')
  })

  test('hides and resets when waiting stops', () => {
    render(<ProvisionWaitingOverlay />)
    startWaiting()
    act(() => jest.advanceTimersByTime(400))
    expect(screen.queryByTestId('spinner')).not.toBeNull()

    stopWaiting()
    expect(screen.queryByTestId('spinner')).toBeNull()
  })

  test('fast RPC never flashes the overlay', () => {
    render(<ProvisionWaitingOverlay />)
    startWaiting()
    act(() => jest.advanceTimersByTime(100))
    stopWaiting()
    act(() => jest.advanceTimersByTime(1000))
    expect(screen.queryByTestId('spinner')).toBeNull()
  })

  test('cancel pauses the flow and navigates up', () => {
    render(<ProvisionWaitingOverlay />)
    startWaiting()
    act(() => jest.advanceTimersByTime(10300))

    act(() => screen.getByText('Cancel').click())
    expect(mockPauseProvision).toHaveBeenCalled()
    expect(mockNavigateUp).toHaveBeenCalled()
  })

  test('popping the screen while waiting pauses the flow', () => {
    render(<ProvisionWaitingOverlay />)
    expect(beforeRemove).toBeDefined()

    beforeRemove?.({data: {action: {type: 'POP'}}})
    expect(mockPauseProvision).not.toHaveBeenCalled()

    startWaiting()
    beforeRemove?.({data: {action: {type: 'POP'}}})
    expect(mockPauseProvision).toHaveBeenCalled()
  })

  test('a non-back removal (e.g. login success unmounting the stack) does not pause', () => {
    render(<ProvisionWaitingOverlay />)
    expect(beforeRemove).toBeDefined()

    startWaiting()
    beforeRemove?.({data: {action: {type: 'RESET'}}})
    expect(mockPauseProvision).not.toHaveBeenCalled()
  })
})
