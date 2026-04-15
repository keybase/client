/** @jest-environment jsdom */
/// <reference types="jest" />

import * as React from 'react'
import {cleanup, render} from '@testing-library/react'
import * as T from '@/constants/types'

const mockSubmitResetPrompt = jest.fn()
const mockAddListener = jest.fn()
const mockSetOptions = jest.fn()

jest.mock('@/constants', () => ({
  waitingKeyAutoresetActuallyReset: 'waitingKeyAutoresetActuallyReset',
}))

jest.mock('@/common-adapters', () => {
  const React = require('react')
  return {
    Box2: ({children}: {children?: React.ReactNode}) => React.createElement('div', null, children),
    Button: ({label, onClick}: {label?: string; onClick?: () => void}) =>
      React.createElement('button', {onClick, type: 'button'}, label),
    ButtonBar: ({children}: {children?: React.ReactNode}) => React.createElement('div', null, children),
    Checkbox: () => React.createElement('div'),
    HeaderLeftButton: ({onPress}: {onPress?: () => void}) =>
      React.createElement('button', {onClick: onPress, type: 'button'}, 'Back'),
    Icon: () => React.createElement('div'),
    Styles: {
      collapseStyles: (styles: Array<Record<string, unknown>>) => Object.assign({}, ...styles),
      globalColors: {black: 'black', black_10: '#0000001a'},
      globalMargins: {medium: 16, small: 8, tiny: 4, xsmall: 2},
      globalStyles: {flexOne: {}},
      isMobile: false,
      padding: () => ({}),
      platformStyles: (styles: {common?: Record<string, unknown>; isElectron?: Record<string, unknown>}) =>
        styles.common ?? styles.isElectron ?? {},
      styleSheetCreate: <T,>(styles: () => T) => styles(),
    },
    Text: ({children, onClick}: {children?: React.ReactNode; onClick?: () => void}) =>
      React.createElement('span', {onClick}, children),
    WaitingButton: ({label, onClick}: {label?: string; onClick?: () => void}) =>
      React.createElement('button', {onClick, type: 'button'}, label),
  }
})

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
}))

jest.mock('./account-reset', () => ({
  submitResetPrompt: (...args: Array<unknown>) => mockSubmitResetPrompt(...args),
}))

import {useNavigation} from '@react-navigation/native'
import ConfirmReset from './confirm'

describe('ConfirmReset', () => {
  let beforeRemove: undefined | (() => void)
  let unsubscribe: jest.Mock

  beforeEach(() => {
    beforeRemove = undefined
    unsubscribe = jest.fn()
    mockAddListener.mockReset()
    mockAddListener.mockImplementation((event: string, callback: () => void) => {
      if (event === 'beforeRemove') {
        beforeRemove = callback
      }
      return unsubscribe
    })
    mockSetOptions.mockReset()
    mockSubmitResetPrompt.mockReset()
    ;(useNavigation as jest.Mock).mockReturnValue({
      addListener: mockAddListener,
      setOptions: mockSetOptions,
    })
  })

  afterEach(() => {
    cleanup()
  })

  test('does not resolve the prompt during effect cleanup', () => {
    const view = render(<ConfirmReset route={{params: {hasWallet: false, resetKey: 'reset-1'}}} />)

    expect(mockAddListener).toHaveBeenCalledWith('beforeRemove', expect.any(Function))
    expect(mockSubmitResetPrompt).not.toHaveBeenCalled()

    view.unmount()

    expect(unsubscribe).toHaveBeenCalled()
    expect(mockSubmitResetPrompt).not.toHaveBeenCalled()
  })

  test('resolves the prompt from beforeRemove only once', () => {
    render(<ConfirmReset route={{params: {hasWallet: false, resetKey: 'reset-1'}}} />)

    expect(beforeRemove).toBeDefined()

    beforeRemove?.()
    beforeRemove?.()

    expect(mockSubmitResetPrompt).toHaveBeenCalledTimes(1)
    expect(mockSubmitResetPrompt).toHaveBeenCalledWith(
      'reset-1',
      T.RPCGen.ResetPromptResponse.nothing
    )
  })
})
