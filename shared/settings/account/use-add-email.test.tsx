/** @jest-environment jsdom */
/// <reference types="jest" />
// useRPC is exported as a re-export getter (non-configurable), so we mock the
// module to make it a plain configurable property that jest.spyOn can wrap.
jest.mock('@/constants', () => ({
  ...(jest.requireActual('@/constants') as object),
  useRPC: jest.fn(),
}))

import {act, cleanup, renderHook} from '@testing-library/react'
import * as C from '@/constants'
import * as T from '@/constants/types'
import RPCError from '@/util/rpcerror'
import {resetAllStores} from '@/util/zustand'
import {useAddEmail} from './use-add-email'

type AddEmailSubmit = (
  args: [{email: string; visibility: T.RPCGen.IdentityVisibility}, string],
  resolve: () => void,
  reject: (error: RPCError) => void
) => void

const mockAddEmailRPC = () => {
  const pending = new Array<{reject: (error: RPCError) => void; resolve: () => void}>()
  const submit = jest.fn(
    (
      _args: Parameters<AddEmailSubmit>[0],
      resolve: Parameters<AddEmailSubmit>[1],
      reject: Parameters<AddEmailSubmit>[2]
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
  jest.restoreAllMocks()
  resetAllStores()
})

test('submitEmail rejects invalid addresses before hitting the service', () => {
  const rpc = mockAddEmailRPC()
  const onSuccess = jest.fn()
  const {result} = renderHook(() => useAddEmail())

  act(() => {
    result.current.submitEmail('not-an-email', false, onSuccess)
  })

  expect(result.current.error).toBe('Invalid email address.')
  expect(rpc.submit).not.toHaveBeenCalled()
  expect(onSuccess).not.toHaveBeenCalled()

  act(() => {
    result.current.submitEmail('', false, onSuccess)
  })
  expect(result.current.error).toBe('Empty email address.')
})

test('submitEmail maps searchable to identity visibility and reports success', () => {
  const rpc = mockAddEmailRPC()
  const onSuccess = jest.fn()
  const {result} = renderHook(() => useAddEmail())

  act(() => {
    result.current.submitEmail('testuser@example.com', true, onSuccess)
  })

  expect(rpc.submit).toHaveBeenCalledWith(
    [
      {email: 'testuser@example.com', visibility: T.RPCGen.IdentityVisibility.public},
      C.addEmailWaitingKey,
    ],
    expect.any(Function),
    expect.any(Function)
  )

  act(() => {
    rpc.resolveNext()
  })
  expect(onSuccess).toHaveBeenCalledWith('testuser@example.com')
  expect(result.current.error).toBe('')

  act(() => {
    result.current.submitEmail('testuser2@example.com', false, onSuccess)
  })
  expect(rpc.submit).toHaveBeenLastCalledWith(
    [
      {email: 'testuser2@example.com', visibility: T.RPCGen.IdentityVisibility.private},
      C.addEmailWaitingKey,
    ],
    expect.any(Function),
    expect.any(Function)
  )
})

test('submitEmail turns known RPC status codes into friendly errors', () => {
  const rpc = mockAddEmailRPC()
  const {result} = renderHook(() => useAddEmail())

  const submitAndFail = (error: RPCError) => {
    act(() => {
      result.current.submitEmail('testuser@example.com', false, jest.fn())
    })
    act(() => {
      rpc.rejectNext(error)
    })
  }

  submitAndFail(new RPCError('rate', T.RPCGen.StatusCode.scratelimit))
  expect(result.current.error).toBe(
    "Sorry, you've added too many email addresses lately. Please try again later."
  )

  submitAndFail(new RPCError('taken', T.RPCGen.StatusCode.scemailtaken))
  expect(result.current.error).toBe('This email is already claimed by another user.')

  submitAndFail(new RPCError('limit', T.RPCGen.StatusCode.scemaillimitexceeded))
  expect(result.current.error).toBe('You have too many emails, delete one and try again.')

  submitAndFail(new RPCError('input', T.RPCGen.StatusCode.scinputerror))
  expect(result.current.error).toBe('Invalid email.')
})

test('submitEmail falls back to the raw message for unknown errors and clearError resets', () => {
  const rpc = mockAddEmailRPC()
  const {result} = renderHook(() => useAddEmail())

  act(() => {
    result.current.submitEmail('testuser@example.com', false, jest.fn())
  })
  act(() => {
    rpc.rejectNext(new RPCError('something else broke', T.RPCGen.StatusCode.scgeneric))
  })
  expect(result.current.error).toBe('ERROR CODE 218 - something else broke')

  act(() => {
    result.current.clearError()
  })
  expect(result.current.error).toBe('')
})
