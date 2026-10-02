/** @jest-environment jsdom */
/// <reference types="jest" />

import * as React from 'react'
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
import * as T from '@/constants/types'

// The confirm prompt's close, settled by its answer as the pipeline's prompt would be
let mockClosed: undefined | {promise: Promise<unknown>; resolve: () => void}
const mockSubmitResetPrompt = jest.fn((..._args: Array<unknown>) => {
  const closed = mockClosed
  mockClosed = undefined
  closed?.resolve()
})
const mockSetOptions = jest.fn()
// The screen's route: its beforeRemove listeners. Each add is its own entry, so a listener added twice
// shows even where both adds pass the same function.
const mockBeforeRemove = new Set<{cb: () => void}>()
const mockNavigation = {
  addListener: (type: string, cb: () => void) => {
    if (type !== 'beforeRemove') return () => {}
    const entry = {cb}
    mockBeforeRemove.add(entry)
    return () => mockBeforeRemove.delete(entry)
  },
  setOptions: mockSetOptions,
}

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

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
}))

jest.mock('./account-reset', () => ({
  resetPromptClosed: (): Promise<unknown> | undefined => mockClosed?.promise,
  submitResetPrompt: (...args: Array<unknown>) => mockSubmitResetPrompt(...args),
}))

import ConfirmReset from './confirm'

const settle = async () => act(async () => {})

// `hidden` hides the screen the way native-stack does under other screens: its effects are torn down
const OnRoute = ({hidden = false}: {hidden?: boolean}) => (
  <React.Activity mode={hidden ? 'hidden' : 'visible'}>
    <ConfirmReset route={{params: {hasWallet: false, promptId: 1}}} />
  </React.Activity>
)

const removeRoute = () => act(() => [...mockBeforeRemove].forEach(({cb}) => cb()))

describe('ConfirmReset', () => {
  beforeEach(() => {
    let resolveClosed = () => {}
    const promise = new Promise<void>(resolve => {
      resolveClosed = resolve
    })
    mockClosed = {promise, resolve: resolveClosed}
    mockBeforeRemove.clear()
    mockSetOptions.mockReset()
    mockSubmitResetPrompt.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  // StrictMode renders twice and mounts the screen's effects, unmounts them and mounts them again
  const mount = () => {
    const view = render(<OnRoute />, {reactStrictMode: true})
    // One listener for the route, however often the screen rendered
    expect(mockBeforeRemove.size).toBe(1)
    return {setHidden: (hidden: boolean) => view.rerender(<OnRoute hidden={hidden} />), view}
  }

  test('effect cleanups neither answer the prompt nor stop listening for the removal', () => {
    const {view} = mount()
    view.unmount()

    expect(mockSubmitResetPrompt).not.toHaveBeenCalled()
    expect(mockBeforeRemove.size).toBe(1)
  })

  test('removing the screen answers the prompt nothing, once', () => {
    mount()

    removeRoute()
    removeRoute()

    expect(mockSubmitResetPrompt).toHaveBeenCalledTimes(1)
    expect(mockSubmitResetPrompt).toHaveBeenCalledWith(1, T.RPCGen.ResetPromptResponse.nothing)
  })

  test('a screen removed while hidden answers the prompt nothing, once', async () => {
    const {setHidden} = mount()
    setHidden(true)
    await settle()

    removeRoute()

    expect(mockSubmitResetPrompt).toHaveBeenCalledTimes(1)
    expect(mockSubmitResetPrompt).toHaveBeenCalledWith(1, T.RPCGen.ResetPromptResponse.nothing)
  })

  test('a screen hidden and shown again answers the prompt nothing on its header back, once', async () => {
    const {setHidden} = mount()
    setHidden(true)
    await settle()
    setHidden(false)
    await settle()
    expect(mockBeforeRemove.size).toBe(1)

    // The header back answers, and the pop it leads to finds the prompt answered
    const options = mockSetOptions.mock.calls.at(-1)![0] as {headerLeft: () => React.ReactElement}
    render(options.headerLeft())
    fireEvent.click(screen.getByText('Back'))
    removeRoute()

    expect(mockSubmitResetPrompt).toHaveBeenCalledTimes(1)
    expect(mockSubmitResetPrompt).toHaveBeenCalledWith(1, T.RPCGen.ResetPromptResponse.nothing)
  })

  test('an answered prompt is not answered again when its screen goes, and its listener goes with it', async () => {
    mount()
    fireEvent.click(screen.getByText('cancel the reset'))
    await settle()
    expect(mockBeforeRemove.size).toBe(0)

    removeRoute()

    expect(mockSubmitResetPrompt).toHaveBeenCalledTimes(1)
    expect(mockSubmitResetPrompt).toHaveBeenCalledWith(1, T.RPCGen.ResetPromptResponse.cancelReset)
  })
})
