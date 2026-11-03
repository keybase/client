/** @jest-environment jsdom */
/// <reference types="jest" />

import type * as React from 'react'
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
import {CommonActions, StackActions} from '@react-navigation/core'
import * as T from '@/constants/types'
import {navigationRef} from '@/constants/navigator'
import {navigationWrapper, stackKeyOf} from '@/test/navigation'

const mockSubmitResetPrompt = jest.fn()

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
    ModalFooter: ({children}: {children?: React.ReactNode}) => React.createElement('div', null, children),
    Styles: {
      border: () => ({}),
      borderRadius: 4,
      collapseStyles: (styles: Array<Record<string, unknown>>) => Object.assign({}, ...styles),
      globalMargins: {medium: 16, small: 8, tiny: 4, xsmall: 2},
      globalStyles: {flexOne: {}},
      isMobile: false,
      marginH: () => ({}),
      marginV: () => ({}),
      padding: () => ({}),
      paddingH: () => ({}),
      paddingV: () => ({}),
      platformStyles: (styles: {common?: Record<string, unknown>; isElectron?: Record<string, unknown>}) =>
        styles.common ?? styles.isElectron ?? {},
      bottomDivider: () => ({}),
      centered: () => ({}),
      roundedBottom: () => ({}),
      size: () => ({}),
      createStyleHook: <T,>(styles: (theme: unknown) => T) => () => styles({black: 'black', black_10: '#0000001a'}),
      textEllipsis: {},
      topDivider: () => ({}),
      useTheme: () => ({black: 'black', black_10: '#0000001a'}),
    },
    Text: ({children, onClick}: {children?: React.ReactNode; onClick?: () => void}) =>
      React.createElement('span', {onClick}, children),
    WaitingButton: ({label, onClick}: {label?: string; onClick?: () => void}) =>
      React.createElement('button', {onClick, type: 'button'}, label),
  }
})

jest.mock('./account-reset', () => ({
  submitResetPrompt: (...args: Array<unknown>) => mockSubmitResetPrompt(...args),
}))

import ConfirmReset from './confirm'

const params = {hasWallet: false, resetKey: 'reset-1'}

// The confirm screen as a real route of the logged-out stack.
const renderConfirm = () => {
  const nav = navigationWrapper({params, route: 'resetConfirm'})
  const view = render(<ConfirmReset route={{params}} />, {wrapper: nav.wrapper})
  const confirmRoute = () =>
    nav.getRootState()?.routes?.[0]?.state?.routes.find(r => r.name === 'resetConfirm')
  return {confirmRoute, nav, view}
}

describe('ConfirmReset', () => {
  beforeEach(() => {
    mockSubmitResetPrompt.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  test('does not resolve the prompt when it unmounts without being removed', () => {
    const {view} = renderConfirm()

    expect(screen.getByText('Yes, reset account')).toBeTruthy()
    view.unmount()

    expect(mockSubmitResetPrompt).not.toHaveBeenCalled()
  })

  test.each([
    ['GO_BACK', () => CommonActions.goBack()],
    ['POP', () => StackActions.pop()],
  ] as const)('the screen being taken away (%s) resolves the prompt with nothing', (_type, action) => {
    const {confirmRoute} = renderConfirm()

    act(() => navigationRef.dispatch(action()))

    expect(confirmRoute()).toBeUndefined()
    expect(mockSubmitResetPrompt).toHaveBeenCalledTimes(1)
    expect(mockSubmitResetPrompt).toHaveBeenCalledWith('reset-1', T.RPCGen.ResetPromptResponse.nothing)
  })

  test('a native dismissal resolves the prompt with nothing', () => {
    const {confirmRoute} = renderConfirm()

    act(() =>
      navigationRef.dispatch({
        ...StackActions.dismiss(),
        source: confirmRoute()?.key,
        target: stackKeyOf('resetConfirm'),
      })
    )

    expect(confirmRoute()).toBeUndefined()
    expect(mockSubmitResetPrompt).toHaveBeenCalledTimes(1)
    expect(mockSubmitResetPrompt).toHaveBeenCalledWith('reset-1', T.RPCGen.ResetPromptResponse.nothing)
  })

  test('removing the screen after an answer does not answer again', () => {
    const {confirmRoute} = renderConfirm()

    fireEvent.click(screen.getByText('Yes, reset account'))
    act(() => navigationRef.dispatch(CommonActions.goBack()))

    expect(confirmRoute()).toBeUndefined()
    expect(mockSubmitResetPrompt).toHaveBeenCalledTimes(1)
    expect(mockSubmitResetPrompt).toHaveBeenCalledWith('reset-1', T.RPCGen.ResetPromptResponse.confirmReset)
  })
})
