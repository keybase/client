/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'

// useRPC is exported as a re-export getter (non-configurable), so we mock the
// module to make it a plain configurable property that jest.spyOn can wrap.
jest.mock('@/constants', () => ({
  ...(jest.requireActual('@/constants') as object),
  useRPC: jest.fn(),
}))
jest.mock('@/constants/router', () => ({navigateUp: jest.fn()}))
// the confirmation gate is the logic under test; the chrome around it is
// native/electron-only
jest.mock('@/common-adapters', () => {
  const React = require('react')
  const passThrough = ({children}: {children?: React.ReactNode}) =>
    React.createElement('div', null, children)
  return {
    Avatar: () => React.createElement('div'),
    Box2: passThrough,
    Checkbox: ({label, onCheck}: {label?: string; onCheck?: (b: boolean) => void}) =>
      React.createElement(
        'button',
        {onClick: () => onCheck?.(false), type: 'button'},
        label
      ),
    ConfirmButtons: ({
      confirmDisabled,
      confirmLabel,
      onConfirm,
    }: {
      confirmDisabled?: boolean
      confirmLabel?: string
      onConfirm?: () => void
    }) =>
      React.createElement(
        'button',
        {disabled: confirmDisabled, onClick: onConfirm, type: 'button'},
        confirmLabel
      ),
    ErrorBanner: ({error}: {error?: string}) => (error ? React.createElement('div', null, error) : null),
    ImageIcon: () => React.createElement('div'),
    Input3: ({
      onChangeText,
      placeholder,
      value,
    }: {
      onChangeText?: (t: string) => void
      placeholder?: string
      value?: string
    }) =>
      React.createElement('input', {
        onChange: (e: {target: {value: string}}) => onChangeText?.(e.target.value),
        placeholder,
        value,
      }),
    ScrollView: passThrough,
    Styles: {
      createStyleHook:
        <S,>(styles: (theme: unknown) => S) =>
        () =>
          styles({redDark: 'redDark'}),
      globalMargins: {large: 24, small: 8},
      platformStyles: (s: {common?: object; isElectron?: object}) => s.common ?? s.isElectron ?? {},
    },
    Text: ({children}: {children?: React.ReactNode}) => React.createElement('span', null, children),
  }
})

import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
import * as C from '@/constants'
import * as T from '@/constants/types'
import {navigateUp} from '@/constants/router'
import {resetAllStores} from '@/util/zustand'
import DeleteRepo from './delete-repo'

const mockDeleteRPCs = () => {
  const personal = jest.fn()
  const team = jest.fn()
  jest.spyOn(C, 'useRPC').mockImplementation(((rpc: unknown) =>
    rpc === T.RPCGen.gitDeleteTeamRepoRpcPromise ? team : personal) as never)
  return {personal, team}
}

const confirmButton = () => screen.getByText(/Delete this repository|^Delete$/) as HTMLButtonElement
const typeName = (name: string) =>
  fireEvent.change(screen.getByPlaceholderText('Name of the repository'), {target: {value: name}})

afterEach(() => {
  cleanup()
  jest.clearAllMocks()
  jest.restoreAllMocks()
  resetAllStores()
})

test('deleting a personal repo needs the exact repo name typed back', () => {
  const rpcs = mockDeleteRPCs()
  render(<DeleteRepo name="myrepo" />)

  expect(confirmButton().disabled).toBe(true)

  typeName('myrep')
  expect(confirmButton().disabled).toBe(true)
  fireEvent.click(confirmButton())
  expect(rpcs.personal).not.toHaveBeenCalled()

  typeName('myrepo')
  expect(confirmButton().disabled).toBe(false)
  fireEvent.click(confirmButton())
  expect(rpcs.personal).toHaveBeenCalledWith(
    [{repoName: 'myrepo'}, C.waitingKeyGitLoading],
    navigateUp,
    expect.any(Function)
  )
  expect(rpcs.team).not.toHaveBeenCalled()
})

test('a team repo also accepts the fully qualified teamname/repo form', () => {
  mockDeleteRPCs()
  render(<DeleteRepo name="myrepo" teamname="keybase.sub" />)

  typeName('myrepo')
  expect(confirmButton().disabled).toBe(false)

  typeName('keybase.sub/myrepo')
  expect(confirmButton().disabled).toBe(false)

  typeName('keybase.sub/other')
  expect(confirmButton().disabled).toBe(true)
})

test('a team delete splits the team name into parts and notifies the team by default', () => {
  const rpcs = mockDeleteRPCs()
  render(<DeleteRepo name="myrepo" teamname="keybase.sub" />)

  typeName('keybase.sub/myrepo')
  fireEvent.click(confirmButton())

  expect(rpcs.team).toHaveBeenCalledWith(
    [
      {notifyTeam: true, repoName: 'myrepo', teamName: {parts: ['keybase', 'sub']}},
      C.waitingKeyGitLoading,
    ],
    navigateUp,
    expect.any(Function)
  )
  expect(rpcs.personal).not.toHaveBeenCalled()
})

test('unchecking notify the team is respected', () => {
  const rpcs = mockDeleteRPCs()
  render(<DeleteRepo name="myrepo" teamname="keybase" />)

  fireEvent.click(screen.getByText('Notify the team'))
  typeName('myrepo')
  fireEvent.click(confirmButton())

  expect(rpcs.team).toHaveBeenCalledWith(
    [{notifyTeam: false, repoName: 'myrepo', teamName: {parts: ['keybase']}}, C.waitingKeyGitLoading],
    navigateUp,
    expect.any(Function)
  )
})

test('failures from the service are shown to the user', () => {
  const rpcs = mockDeleteRPCs()
  render(<DeleteRepo name="myrepo" />)

  typeName('myrepo')
  fireEvent.click(confirmButton())

  const onError = rpcs.personal.mock.calls[0]?.[2] as (e: Error) => void
  act(() => {
    onError(new Error('repo is locked'))
  })

  expect(screen.queryByText('repo is locked')).not.toBeNull()
})
