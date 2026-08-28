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
import logger from '@/logger'
import {resetAllStores} from '@/util/zustand'
import {usePasswordCheck} from './use-password-check'

type CheckSubmit = (
  args: [{passphrase: string}, string],
  resolve: (correct: boolean) => void,
  reject: (error: RPCError) => void
) => void

const mockCheckRPC = () => {
  const pending = new Array<{reject: (error: RPCError) => void; resolve: (correct: boolean) => void}>()
  const submit = jest.fn(
    (
      _args: Parameters<CheckSubmit>[0],
      resolve: Parameters<CheckSubmit>[1],
      reject: Parameters<CheckSubmit>[2]
    ) => {
      pending.push({reject, resolve})
    }
  )
  jest.spyOn(C, 'useRPC').mockImplementation((() => submit) as never)
  return {
    rejectNext: (error: RPCError) => pending.shift()?.reject(error),
    resolveNext: (correct: boolean) => pending.shift()?.resolve(correct),
    submit,
  }
}

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

test('checkPassword forwards the passphrase and records the answer', () => {
  const rpc = mockCheckRPC()
  const {result} = renderHook(() => usePasswordCheck())

  expect(result.current.checkPasswordIsCorrect).toBeUndefined()

  act(() => {
    result.current.checkPassword('open sesame')
  })

  expect(rpc.submit).toHaveBeenCalledWith(
    [{passphrase: 'open sesame'}, C.waitingKeySettingsCheckPassword],
    expect.any(Function),
    expect.any(Function)
  )

  act(() => {
    rpc.resolveNext(true)
  })
  expect(result.current.checkPasswordIsCorrect).toBe(true)

  act(() => {
    result.current.checkPassword('nope')
  })
  act(() => {
    rpc.resolveNext(false)
  })
  expect(result.current.checkPasswordIsCorrect).toBe(false)
})

test('a new check clears the previous answer while it is in flight', () => {
  const rpc = mockCheckRPC()
  const {result} = renderHook(() => usePasswordCheck())

  act(() => {
    result.current.checkPassword('open sesame')
  })
  act(() => {
    rpc.resolveNext(true)
  })
  expect(result.current.checkPasswordIsCorrect).toBe(true)

  act(() => {
    result.current.checkPassword('again')
  })
  expect(result.current.checkPasswordIsCorrect).toBeUndefined()
})

test('errors clear the answer and are logged rather than surfaced', () => {
  const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {})
  const rpc = mockCheckRPC()
  const {result} = renderHook(() => usePasswordCheck())

  act(() => {
    result.current.checkPassword('open sesame')
  })
  act(() => {
    rpc.resolveNext(true)
  })
  act(() => {
    result.current.checkPassword('boom')
  })
  act(() => {
    rpc.rejectNext(new RPCError('nope', T.RPCGen.StatusCode.scgeneric))
  })

  expect(result.current.checkPasswordIsCorrect).toBeUndefined()
  expect(warnSpy).toHaveBeenCalledWith(
    'Error checking password',
    expect.objectContaining({code: T.RPCGen.StatusCode.scgeneric})
  )
})

test('reset clears the answer', () => {
  const rpc = mockCheckRPC()
  const {result} = renderHook(() => usePasswordCheck())

  act(() => {
    result.current.checkPassword('open sesame')
  })
  act(() => {
    rpc.resolveNext(true)
  })

  act(() => {
    result.current.reset()
  })
  expect(result.current.checkPasswordIsCorrect).toBeUndefined()
})
