/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'

// useRPC is exported as a re-export getter (non-configurable), so we mock the
// module to make it a plain configurable property that jest.spyOn can wrap.
jest.mock('@/constants', () => ({
  ...(jest.requireActual('@/constants') as object),
  useRPC: jest.fn(),
}))
jest.mock('@/constants/router', () => ({
  clearModals: jest.fn(),
  navigateAppend: jest.fn(),
  navigateUp: jest.fn(),
  switchTab: jest.fn(),
}))
// the real components pull in native/electron-only rendering; we only care
// about the password validation logic here
jest.mock('@/common-adapters', () => {
  const React = require('react')
  const passThrough = ({children}: {children?: React.ReactNode}) =>
    React.createElement('div', null, children)
  return {
    Banner: passThrough,
    BannerParagraph: ({content}: {content?: string}) => React.createElement('div', null, content),
    Box2: passThrough,
    Button: ({label, disabled, onClick}: {label?: string; disabled?: boolean; onClick?: () => void}) =>
      React.createElement('button', {disabled, onClick, type: 'button'}, label),
    ButtonBar: passThrough,
    Checkbox: ({label, onCheck}: {label?: string; onCheck?: () => void}) =>
      React.createElement('button', {onClick: onCheck, type: 'button'}, label),
    Icon: () => React.createElement('div'),
    Input3: ({
      placeholder,
      onChangeText,
      value,
    }: {
      placeholder?: string
      onChangeText?: (t: string) => void
      value?: string
    }) =>
      React.createElement('input', {
        onChange: (e: {target: {value: string}}) => onChangeText?.(e.target.value),
        placeholder,
        value,
      }),
    ModalFooter: passThrough,
    RoundedBox: passThrough,
    ScrollView: passThrough,
    Styles: {
      createStyleHook:
        <S,>(styles: (theme: unknown) => S) =>
        () =>
          styles({blueGrey: 'blueGrey', green: 'green'}),
      globalMargins: {small: 8, tiny: 4, xtiny: 2},
      globalStyles: {flexOne: {}},
      isTablet: false,
      useTheme: () => ({blueGrey: 'blueGrey', green: 'green'}),
    },
    Text: ({children}: {children?: React.ReactNode}) => React.createElement('span', null, children),
  }
})

import {act, cleanup, fireEvent, render, renderHook, screen} from '@testing-library/react'
import * as C from '@/constants'
import RPCError from '@/util/rpcerror'
import * as T from '@/constants/types'
import {navigateUp} from '@/constants/router'
import {resetAllStores} from '@/util/zustand'
import {UpdatePassword, useSubmitNewPassword} from './password'

const typePasswords = (password: string, confirm: string) => {
  fireEvent.change(screen.getByPlaceholderText('New password'), {target: {value: password}})
  fireEvent.change(screen.getByPlaceholderText('Confirm password'), {target: {value: confirm}})
}

const saveButton = () => screen.getByText('Save') as HTMLButtonElement

afterEach(() => {
  cleanup()
  jest.clearAllMocks()
  jest.restoreAllMocks()
  resetAllStores()
})

test('save stays disabled until both passwords match and are long enough', () => {
  const onSave = jest.fn()
  render(<UpdatePassword error="" onSave={onSave} />)

  expect(saveButton().disabled).toBe(true)

  typePasswords('short', 'short')
  expect(saveButton().disabled).toBe(true)
  expect(screen.queryByText('Password must be at least 8 characters.')).not.toBeNull()

  typePasswords('longenough', 'longenough')
  expect(saveButton().disabled).toBe(false)
  expect(screen.queryByText('Passwords match.')).not.toBeNull()

  fireEvent.click(saveButton())
  expect(onSave).toHaveBeenCalledWith('longenough')
})

test('mismatched passwords show an error and block saving', () => {
  const onSave = jest.fn()
  render(<UpdatePassword error="" onSave={onSave} />)

  typePasswords('longenough', 'longenoughbutdifferent')
  expect(screen.queryByText('Passwords must match.')).not.toBeNull()
  expect(saveButton().disabled).toBe(true)

  fireEvent.click(saveButton())
  expect(onSave).not.toHaveBeenCalled()
})

test('the PGP warning shows only when there is no other error', () => {
  const {rerender} = render(<UpdatePassword error="" hasPGPKeyOnServer={true} onSave={jest.fn()} />)
  expect(screen.queryByText(/delete your PGP key/)).not.toBeNull()

  rerender(<UpdatePassword error="boom" hasPGPKeyOnServer={true} onSave={jest.fn()} />)
  expect(screen.queryByText(/delete your PGP key/)).toBeNull()
  expect(screen.queryByText('boom')).not.toBeNull()
})

type ChangeSubmit = (
  args: [{force: boolean; oldPassphrase: string; passphrase: string}, string],
  resolve: () => void,
  reject: (error: RPCError) => void
) => void

const mockChangeRPC = () => {
  const pending = new Array<{reject: (error: RPCError) => void; resolve: () => void}>()
  const submit = jest.fn(
    (
      _args: Parameters<ChangeSubmit>[0],
      resolve: Parameters<ChangeSubmit>[1],
      reject: Parameters<ChangeSubmit>[2]
    ) => {
      pending.push({reject, resolve})
    }
  )
  jest.spyOn(C, 'useRPC').mockImplementation((() => submit) as never)
  return {
    rejectNext: (error: RPCError) => pending.shift()?.reject(error),
    resolveNext: () => pending.shift()?.resolve(),
    submit,
  }
}

test('useSubmitNewPassword force-changes the password and navigates back', () => {
  const rpc = mockChangeRPC()
  const {result} = renderHook(() => useSubmitNewPassword(false))

  act(() => {
    result.current.onSave('longenough')
  })

  expect(rpc.submit).toHaveBeenCalledWith(
    [{force: true, oldPassphrase: '', passphrase: 'longenough'}, C.waitingKeySettingsGeneric],
    expect.any(Function),
    expect.any(Function)
  )

  act(() => {
    rpc.resolveNext()
  })
  expect(navigateUp).toHaveBeenCalled()
  expect(result.current.error).toBe('')
})

test('useSubmitNewPassword shows the service description on failure and clears it on retry', () => {
  const rpc = mockChangeRPC()
  const {result} = renderHook(() => useSubmitNewPassword(false))

  act(() => {
    result.current.onSave('longenough')
  })
  act(() => {
    rpc.rejectNext(new RPCError('too weak', T.RPCGen.StatusCode.scgeneric))
  })
  expect(result.current.error).toBe('too weak')
  expect(navigateUp).not.toHaveBeenCalled()

  act(() => {
    result.current.onSave('longenough2')
  })
  expect(result.current.error).toBe('')
})
