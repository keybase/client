/** @jest-environment jsdom */
/// <reference types="jest" />

import * as React from 'react'
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
import * as T from '@/constants/types'
import {makeFakeRoute} from '@/test/fake-route'

// The pipeline's end, which drops the screen's route-gone entry
let mockEnded: undefined | {promise: Promise<void>; resolve: () => void}
const mockSubmitResetPrompt = jest.fn()
const mockDeclineResetPrompt = jest.fn()
const mockSetOptions = jest.fn()
// The screen's beforeRemove listeners, as the navigator would call them on a visible removal
const mockBeforeRemove = new Set<() => void>()
const mockNavigation = {
  addListener: (type: string, cb: () => void) => {
    if (type !== 'beforeRemove') return () => {}
    mockBeforeRemove.add(cb)
    return () => mockBeforeRemove.delete(cb)
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
  declineResetPrompt: (...args: Array<unknown>) => mockDeclineResetPrompt(...args),
  resetRunEnded: (): Promise<void> | undefined => mockEnded?.promise,
  submitResetPrompt: (...args: Array<unknown>) => mockSubmitResetPrompt(...args),
}))

import ConfirmReset from './confirm'

const settle = async () => act(async () => {})

let route: ReturnType<typeof makeFakeRoute>

// `hidden` hides the screen the way native-stack does under other screens: its effects are torn down
const OnRoute = ({hidden = false}: {hidden?: boolean}) => (
  <route.Route>
    <React.Activity mode={hidden ? 'hidden' : 'visible'}>
      <ConfirmReset route={{params: {hasWallet: false, promptId: 1}}} />
    </React.Activity>
  </route.Route>
)

const removeVisible = () => act(() => [...mockBeforeRemove].forEach(cb => cb()))

describe('ConfirmReset', () => {
  beforeEach(() => {
    let resolve = () => {}
    const promise = new Promise<void>(_resolve => {
      resolve = _resolve
    })
    mockEnded = {promise, resolve}
    mockBeforeRemove.clear()
    mockSetOptions.mockReset()
    mockSubmitResetPrompt.mockClear()
    mockDeclineResetPrompt.mockClear()
    route = makeFakeRoute('resetConfirm')
    route.enter({hasWallet: false, promptId: 1})
  })

  afterEach(async () => {
    cleanup()
    // Each test's pipeline ends with it, so its route's entry goes too
    mockEnded?.resolve()
    await settle()
  })

  // StrictMode renders twice and mounts the screen's effects, unmounts them and mounts them again
  const mount = () => {
    const view = render(<OnRoute />, {reactStrictMode: true})
    expect(mockBeforeRemove.size).toBe(1)
    return {setHidden: (hidden: boolean) => view.rerender(<OnRoute hidden={hidden} />), view}
  }

  test('effect cleanups answer nothing', () => {
    const {view} = mount()
    view.unmount()

    expect(mockSubmitResetPrompt).not.toHaveBeenCalled()
    expect(mockDeclineResetPrompt).not.toHaveBeenCalled()
  })

  test('removing the visible screen answers the prompt nothing, once', () => {
    mount()

    removeVisible()
    removeVisible()

    expect(mockSubmitResetPrompt).toHaveBeenCalledTimes(1)
    expect(mockSubmitResetPrompt).toHaveBeenCalledWith(1, T.RPCGen.ResetPromptResponse.nothing)
  })

  test('a screen whose route goes while hidden declines its prompt, once', async () => {
    const {setHidden} = mount()
    setHidden(true)
    await settle()
    removeVisible()
    expect(mockSubmitResetPrompt).not.toHaveBeenCalled()

    route.leave()
    route.leave()

    expect(mockDeclineResetPrompt).toHaveBeenCalledTimes(1)
    expect(mockDeclineResetPrompt).toHaveBeenCalledWith(1)
  })

  test('a screen whose root is swapped out declines its prompt', () => {
    mount()

    route.leave()

    expect(mockDeclineResetPrompt).toHaveBeenCalledWith(1)
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
    removeVisible()

    expect(mockSubmitResetPrompt).toHaveBeenCalledTimes(1)
    expect(mockSubmitResetPrompt).toHaveBeenCalledWith(1, T.RPCGen.ResetPromptResponse.nothing)
  })

  test('once the pipeline is over its route going answers nothing', async () => {
    mount()
    mockEnded?.resolve()
    await settle()

    route.leave()

    expect(mockDeclineResetPrompt).not.toHaveBeenCalled()
  })
})
