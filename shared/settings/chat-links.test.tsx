/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'

// useRPC is exported as a re-export getter (non-configurable), so we mock the
// module to make it a plain configurable property that jest.spyOn can wrap.
jest.mock('@/constants', () => ({
  ...(jest.requireActual('@/constants') as object),
  useRPC: jest.fn(),
}))
// the real components pull in native/electron-only rendering; only the link
// preview settings logic matters here
jest.mock('@/common-adapters', () => {
  const React = require('react')
  const passThrough = ({children}: {children?: React.ReactNode}) => React.createElement('div', null, children)
  const anyStyle: unknown = new Proxy(() => anyStyle, {get: () => anyStyle})
  const components: {[k: string]: unknown} = {
    Button: ({label, disabled, onClick}: {label?: string; disabled?: boolean; onClick?: () => void}) =>
      React.createElement('button', {disabled, onClick, type: 'button'}, label),
    Icon: ({onClick}: {onClick?: () => void}) =>
      React.createElement('button', {onClick, type: 'button'}, 'remove'),
    Input3: ({
      disabled,
      onChangeText,
      onEnterKeyDown,
      placeholder,
      value,
    }: {
      disabled?: boolean
      onChangeText?: (t: string) => void
      onEnterKeyDown?: () => void
      placeholder?: string
      value?: string
    }) =>
      React.createElement('input', {
        onChange: (e: {target: {value: string}}) => onChangeText?.(e.target.value),
        onKeyDown: (e: {key: string}) => {
          if (e.key === 'Enter' && !disabled) onEnterKeyDown?.()
        },
        placeholder,
        readOnly: disabled,
        value,
      }),
    RadioButton: ({
      disabled,
      label,
      onSelect,
      selected,
    }: {
      disabled?: boolean
      label: string
      onSelect: (s: boolean) => void
      selected: boolean
    }) =>
      React.createElement(
        'button',
        {'aria-pressed': selected, disabled, onClick: () => onSelect(!selected), type: 'button'},
        label
      ),
    Styles: {
      collapseStyles: () => ({}),
      createStyleHook: () => () => anyStyle,
      globalMargins: anyStyle,
      isMobile: false,
      paddingV: () => ({}),
      platformStyles: () => ({}),
      useTheme: () => anyStyle,
    },
    Text: ({children, onClick}: {children?: React.ReactNode; onClick?: () => void}) =>
      React.createElement('span', {onClick}, children),
    WaitingButton: ({
      disabled,
      label,
      onClick,
      testID,
    }: {
      disabled?: boolean
      label?: string
      onClick?: () => void
      testID?: string
    }) => React.createElement('button', {'data-testid': testID, disabled, onClick, type: 'button'}, label),
  }
  return new Proxy(components, {get: (t, k: string) => t[k] ?? passThrough})
})

import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react'
import * as C from '@/constants'
import * as T from '@/constants/types'
import RPCError from '@/util/rpcerror'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {useWaitingState} from '@/stores/waiting'
import {Links} from './chat'

type Saved = {blocklist?: ReadonlyArray<string>; mode: T.RPCChat.UnfurlMode; whitelist?: ReadonlyArray<string>}

const mockRPCs = (initial: Saved) => {
  let stored: Saved = initial
  const getRPC = jest
    .spyOn(T.RPCChat, 'localGetUnfurlSettingsRpcPromise')
    .mockImplementation(async () => Promise.resolve(stored as never))
  const saves = new Array<{
    args: Saved
    reject: (e: RPCError) => void
    resolve: () => void
  }>()
  const submit = jest.fn((args: [{settings: Saved}, string], resolve: () => void, reject: (e: RPCError) => void) => {
    saves.push({
      args: args[0].settings,
      reject,
      resolve: () => {
        stored = args[0].settings
        resolve()
      },
    })
  })
  jest.spyOn(C, 'useRPC').mockImplementation((() => submit) as never)
  return {getRPC, saves}
}

// the native tsconfig has no DOM lib
const attr = (el: unknown, name: string) =>
  (el as {getAttribute: (n: string) => string | null}).getAttribute(name)
const radio = (label: string) => screen.getByText(label, {exact: true})
const blockInput = () => screen.getAllByPlaceholderText('Add a website, e.g. example.com')[1]!

beforeEach(() => {
  useConfigState.setState({loggedIn: true})
})

afterEach(() => {
  cleanup()
  jest.clearAllMocks()
  jest.restoreAllMocks()
  resetAllStores()
})

const modeLabels = {
  [T.RPCChat.UnfurlMode.always]: 'Allow all',
  [T.RPCChat.UnfurlMode.never]: 'Disallow all',
  [T.RPCChat.UnfurlMode.whitelisted]: 'Ask per domain',
}

const renderLoaded = async (initial: Saved) => {
  const rpcs = mockRPCs(initial)
  render(<Links />)
  await waitFor(() => expect(attr(radio(modeLabels[initial.mode]), 'aria-pressed')).toBe('true'))
  return rpcs
}

const selectAskAndBlock = (domain: string) => {
  fireEvent.click(radio('Ask per domain'))
  fireEvent.change(blockInput(), {target: {value: domain}})
  fireEvent.keyDown(blockInput(), {key: 'Enter'})
}

test('a rejected save keeps the chosen mode and pending edits', async () => {
  const {getRPC, saves} = await renderLoaded({mode: T.RPCChat.UnfurlMode.always})
  selectAskAndBlock('foo.com')
  expect(screen.getByText('foo.com')).toBeTruthy()

  fireEvent.click(screen.getByText('Save'))
  expect(saves).toHaveLength(1)
  await act(async () => {
    saves[0]!.reject(new RPCError('bad domain', 0))
    await Promise.resolve()
  })

  await waitFor(() => expect(screen.getByText(/Unable to save link preview settings: bad domain/)).toBeTruthy())
  expect(attr(radio('Ask per domain'), 'aria-pressed')).toBe('true')
  expect(screen.getByText('foo.com')).toBeTruthy()
  expect(getRPC).toHaveBeenCalledTimes(1)
})

test('a successful save shows the saved settings', async () => {
  const {getRPC, saves} = await renderLoaded({mode: T.RPCChat.UnfurlMode.always})
  selectAskAndBlock('foo.com')
  fireEvent.click(screen.getByText('Save'))
  await act(async () => {
    saves[0]!.resolve()
    await Promise.resolve()
  })

  await waitFor(() => expect(getRPC).toHaveBeenCalledTimes(2))
  await waitFor(() => expect(attr(screen.getByText('Save'), 'disabled')).not.toBeNull())
  expect(attr(radio('Ask per domain'), 'aria-pressed')).toBe('true')
  expect(screen.getByText('foo.com')).toBeTruthy()
})

test('list edits are disabled while a save is in flight', async () => {
  await renderLoaded({mode: T.RPCChat.UnfurlMode.whitelisted})
  act(() => useWaitingState.getState().dispatch.increment(C.waitingKeySettingsChatUnfurl))

  fireEvent.change(blockInput(), {target: {value: 'foo.com'}})
  fireEvent.keyDown(blockInput(), {key: 'Enter'})
  expect(screen.queryByText('foo.com')).toBeNull()
  for (const add of screen.getAllByText('Add')) {
    expect(attr(add, 'disabled')).not.toBeNull()
  }
  expect(attr(radio('Disallow all'), 'disabled')).not.toBeNull()
})
