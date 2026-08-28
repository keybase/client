/** @jest-environment jsdom */
/// <reference types="jest" />
// useRPC is exported as a re-export getter (non-configurable), so we mock the
// module to make it a plain configurable property that jest.spyOn can wrap.
const mockAndroidIsTestDevice = {value: false}
jest.mock('@/constants', () => ({
  ...(jest.requireActual('@/constants') as object),
  // a live getter so a test can flip the platform flag the hook reads
  get androidIsTestDevice() {
    return mockAndroidIsTestDevice.value
  },
  useRPC: jest.fn(),
}))
jest.mock('@/constants/router', () => ({
  clearModals: jest.fn(),
  navigateAppend: jest.fn(),
}))

import {act, cleanup, renderHook} from '@testing-library/react'
import * as C from '@/constants'
import * as T from '@/constants/types'
import RPCError from '@/util/rpcerror'
import logger from '@/logger'
import {clearModals, navigateAppend} from '@/constants/router'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {useDeleteAccount} from './use-delete-account'

type DeleteSubmit = (
  args: [{passphrase?: string}, string],
  resolve: () => void,
  reject: (error: RPCError) => void
) => void

const mockDeleteRPC = () => {
  const pending = new Array<{reject: (error: RPCError) => void; resolve: () => void}>()
  const submit = jest.fn(
    (
      _args: Parameters<DeleteSubmit>[0],
      resolve: Parameters<DeleteSubmit>[1],
      reject: Parameters<DeleteSubmit>[2]
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

afterEach(() => {
  cleanup()
  mockAndroidIsTestDevice.value = false
  jest.clearAllMocks()
  jest.restoreAllMocks()
  resetAllStores()
})

test('refuses to delete when there is no logged in user', () => {
  const rpc = mockDeleteRPC()
  const {result} = renderHook(() => useDeleteAccount())

  expect(() => result.current('hunter2')).toThrow('Unable to delete account: no username set')
  expect(rpc.submit).not.toHaveBeenCalled()
})

test('deletes forever, records the deleted self and sends the user to login', () => {
  useCurrentUserState.setState({username: 'testuser'})
  const setJustDeletedSelf = jest.fn()
  useConfigState.setState(s => ({...s, dispatch: {...s.dispatch, setJustDeletedSelf}}))
  const rpc = mockDeleteRPC()

  const {result} = renderHook(() => useDeleteAccount())

  act(() => {
    result.current('hunter2')
  })

  expect(rpc.submit).toHaveBeenCalledWith(
    [{passphrase: 'hunter2'}, C.waitingKeySettingsGeneric],
    expect.any(Function),
    expect.any(Function)
  )

  act(() => {
    rpc.resolveNext()
  })

  expect(setJustDeletedSelf).toHaveBeenCalledWith('testuser')
  expect(clearModals).toHaveBeenCalled()
  expect(navigateAppend).toHaveBeenCalledWith({name: C.Tabs.loginTab, params: {}})
})

test('passes an undefined passphrase through for accounts without one', () => {
  useCurrentUserState.setState({username: 'testuser'})
  const rpc = mockDeleteRPC()

  const {result} = renderHook(() => useDeleteAccount())

  act(() => {
    result.current()
  })

  expect(rpc.submit).toHaveBeenCalledWith(
    [{passphrase: undefined}, C.waitingKeySettingsGeneric],
    expect.any(Function),
    expect.any(Function)
  )
})

test('pre-launch test devices never reach the delete rpc', () => {
  // android pre-launch reports drive the whole app; deleting the account they
  // run under would be catastrophic
  useCurrentUserState.setState({username: 'testuser'})
  mockAndroidIsTestDevice.value = true
  const rpc = mockDeleteRPC()

  const {result} = renderHook(() => useDeleteAccount())

  act(() => {
    result.current('hunter2')
  })

  expect(rpc.submit).not.toHaveBeenCalled()
  expect(clearModals).not.toHaveBeenCalled()
  expect(navigateAppend).not.toHaveBeenCalled()
})

test('logs and stays put when the delete rpc fails', () => {
  useCurrentUserState.setState({username: 'testuser'})
  const setJustDeletedSelf = jest.fn()
  useConfigState.setState(s => ({...s, dispatch: {...s.dispatch, setJustDeletedSelf}}))
  const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {})
  const rpc = mockDeleteRPC()

  const {result} = renderHook(() => useDeleteAccount())

  act(() => {
    result.current('hunter2')
  })
  act(() => {
    rpc.rejectNext(new RPCError('nope', T.RPCGen.StatusCode.scgeneric))
  })

  expect(warnSpy).toHaveBeenCalledWith(
    'Error deleting account',
    expect.objectContaining({code: T.RPCGen.StatusCode.scgeneric})
  )
  expect(setJustDeletedSelf).not.toHaveBeenCalled()
  expect(clearModals).not.toHaveBeenCalled()
})
