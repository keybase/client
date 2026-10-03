/** @jest-environment jsdom */
/// <reference types="jest" />

import * as React from 'react'
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
import * as T from '@/constants/types'
import {NavigationContext} from '@react-navigation/core'
import {makeFakeRoute} from '@/test/fake-route'

// The pipeline's end, which drops the screen's route-gone entry
let mockEnded: undefined | {promise: Promise<void>; resolve: () => void}
// Whether the screen's prompt is still open to answer
let mockOpen = true
const mockSubmitResetPrompt = jest.fn()
const mockDeclineResetPrompt = jest.fn()
const mockSetOptions = jest.fn()
const mockNavUpToScreen = jest.fn()
// The screen's beforeRemove listeners, as the navigator would call them on a visible removal
type BeforeRemoveEvent = {data: {action: {type: string}}; preventDefault: () => void}
const mockBeforeRemove = new Set<(e: BeforeRemoveEvent) => void>()
const mockNavigation = {
  addListener: (type: string, cb: (e: BeforeRemoveEvent) => void) => {
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

jest.mock('@/constants/router', () => ({
  navUpToScreen: (...args: Array<unknown>) => mockNavUpToScreen(...args),
}))

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
}))

jest.mock('./account-reset', () => ({
  declineResetPrompt: (...args: Array<unknown>) => mockDeclineResetPrompt(...args),
  isResetPromptOpen: () => !!mockEnded && mockOpen,
  resetRunEnded: (): Promise<void> | undefined => mockEnded?.promise,
  submitResetPrompt: (...args: Array<unknown>) => mockSubmitResetPrompt(...args),
}))

import ConfirmReset from './confirm'

const settle = async () => act(async () => {})

let route: ReturnType<typeof makeFakeRoute>

// `hidden` hides the screen the way native-stack does under other screens: its effects are torn down
const OnRoute = ({hidden = false}: {hidden?: boolean}) => (
  <route.Route>
    <NavigationContext value={mockNavigation as never}>
      <React.Activity mode={hidden ? 'hidden' : 'visible'}>
        <ConfirmReset route={{params: {hasWallet: false, promptId: 1}}} />
      </React.Activity>
    </NavigationContext>
  </route.Route>
)

// The visible screen is about to be removed by `type`; returns whether that was prevented
const removeVisible = (type = 'GO_BACK') => {
  const preventDefault = jest.fn()
  act(() => [...mockBeforeRemove].forEach(cb => cb({data: {action: {type}}, preventDefault})))
  return preventDefault.mock.calls.length > 0
}

describe('ConfirmReset', () => {
  beforeEach(() => {
    let resolve = () => {}
    const promise = new Promise<void>(_resolve => {
      resolve = _resolve
    })
    mockEnded = {promise, resolve}
    mockBeforeRemove.clear()
    mockSetOptions.mockReset()
    mockOpen = true
    // Answers the open prompt, which closes it, as the flow would
    mockSubmitResetPrompt.mockReset().mockImplementation(() => {
      const answered = mockOpen
      mockOpen = false
      return answered
    })
    mockNavUpToScreen.mockClear()
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

  test.each(['GO_BACK', 'POP'])(
    'a back (%s) of the visible screen answers the prompt nothing in place of the pop, once',
    type => {
      mount()

      expect(removeVisible(type)).toBe(true)
      // The navigation the answer leads to finds it answered
      expect(removeVisible(type)).toBe(false)

      expect(mockSubmitResetPrompt).toHaveBeenCalledTimes(1)
      expect(mockSubmitResetPrompt).toHaveBeenCalledWith(1, T.RPCGen.ResetPromptResponse.nothing)
    }
  )

  test('a removal that is not a back answers nothing until the route has gone, then declines once', () => {
    mount()

    // Another listener may still prevent it
    expect(removeVisible('REMOVE')).toBe(false)
    expect(mockSubmitResetPrompt).not.toHaveBeenCalled()
    expect(mockDeclineResetPrompt).not.toHaveBeenCalled()
    route.leave()

    expect(mockSubmitResetPrompt).not.toHaveBeenCalled()
    expect(mockDeclineResetPrompt).toHaveBeenCalledTimes(1)
    expect(mockDeclineResetPrompt).toHaveBeenCalledWith(1)
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
    expect(removeVisible('POP')).toBe(false)

    expect(mockSubmitResetPrompt).toHaveBeenCalledTimes(1)
    expect(mockSubmitResetPrompt).toHaveBeenCalledWith(1, T.RPCGen.ResetPromptResponse.nothing)
  })

  test('a back once the prompt is closed is let through, answering nothing', async () => {
    mount()
    const ended = mockEnded!
    mockEnded = undefined

    expect(removeVisible('GO_BACK')).toBe(false)

    expect(mockSubmitResetPrompt).not.toHaveBeenCalled()
    ended.resolve()
    await settle()
  })

  test('once the pipeline is over its route going answers nothing', async () => {
    mount()
    mockEnded?.resolve()
    await settle()

    route.leave()

    expect(mockDeclineResetPrompt).not.toHaveBeenCalled()
  })

  test('with nothing open to answer, each button and back takes the user up to login', () => {
    mount()
    // The prompt closed under the screen: its RPC failed or the service cancelled it
    mockOpen = false

    fireEvent.click(screen.getByText('Close'))
    fireEvent.click(screen.getByText('cancel the reset'))
    const options = mockSetOptions.mock.calls.at(-1)![0] as {headerLeft: () => React.ReactElement}
    render(options.headerLeft())
    fireEvent.click(screen.getByText('Back'))

    expect(mockSubmitResetPrompt).toHaveBeenCalledTimes(3)
    expect(mockNavUpToScreen.mock.calls).toEqual([['login'], ['login'], ['login']])
  })

  test('once a button answered, the other buttons do nothing', () => {
    mount()

    fireEvent.click(screen.getByText('Close'))
    fireEvent.click(screen.getByText('cancel the reset'))

    expect(mockSubmitResetPrompt).toHaveBeenCalledTimes(1)
    expect(mockSubmitResetPrompt).toHaveBeenCalledWith(1, T.RPCGen.ResetPromptResponse.nothing)
    expect(mockNavUpToScreen).not.toHaveBeenCalled()
  })
})
