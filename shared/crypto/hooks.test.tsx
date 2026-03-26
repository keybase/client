/** @jest-environment jsdom */
/// <reference types="jest" />

import {afterEach, beforeEach, expect, jest, test} from '@jest/globals'
import {act, cleanup, renderHook, waitFor} from '@testing-library/react'
import * as T from '@/constants/types'
import {useCurrentUserState} from '@/stores/current-user'
import {useDecryptState} from './decrypt'
import {useEncryptScreenState} from './encrypt'
import {useSignState} from './sign'
import {useVerifyState} from './verify'

type HookController = {
  state: {
    errorMessage: string
    output: string
    outputValid: boolean
  }
  setInput: (type: T.Crypto.InputTypes, value: string) => void
}

beforeEach(() => {
  useCurrentUserState.setState({username: 'alice'} as never)
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  useCurrentUserState.getState().dispatch.resetState()
})

test('encrypt auto-run uses the latest text snapshot and keeps output valid', async () => {
  const encryptSpy = jest
    .spyOn(T.RPCGen, 'saltpackSaltpackEncryptStringRpcPromise')
    .mockImplementation(({plaintext}) =>
      Promise.resolve({
        ciphertext: `cipher:${plaintext}`,
        unresolvedSBSAssertion: '',
        usedUnresolvedSBS: false,
      } as never)
    )

  const {result} = renderHook((): HookController => useEncryptScreenState())
  act(() => {
    result.current.setInput('text', 'secret message')
  })

  await waitFor(() =>
    expect(encryptSpy).toHaveBeenCalledWith(
      expect.objectContaining({plaintext: 'secret message'}),
      expect.anything()
    )
  )
  await waitFor(() => expect(result.current.state.output).toBe('cipher:secret message'))

  expect(result.current.state.outputValid).toBe(true)
  expect(result.current.state.errorMessage).toBe('')
})

test('decrypt auto-run uses the pasted ciphertext instead of the previous input', async () => {
  const decryptSpy = jest
    .spyOn(T.RPCGen, 'saltpackSaltpackDecryptStringRpcPromise')
    .mockImplementation(({ciphertext}) =>
      Promise.resolve({
        info: {sender: {fullname: 'Bob', username: 'bob'}},
        plaintext: `plain:${ciphertext}`,
        signed: true,
      } as never)
    )

  const {result} = renderHook((): HookController => useDecryptState())
  act(() => {
    result.current.setInput('text', 'encrypted payload')
  })

  await waitFor(() =>
    expect(decryptSpy).toHaveBeenCalledWith(
      expect.objectContaining({ciphertext: 'encrypted payload'}),
      expect.anything()
    )
  )
  await waitFor(() => expect(result.current.state.output).toBe('plain:encrypted payload'))

  expect(result.current.state.outputValid).toBe(true)
  expect(result.current.state.errorMessage).toBe('')
})

test('sign auto-run uses the latest text snapshot and keeps output valid', async () => {
  const signSpy = jest
    .spyOn(T.RPCGen, 'saltpackSaltpackSignStringRpcPromise')
    .mockImplementation(({plaintext}) => Promise.resolve(`signed:${plaintext}` as never))

  const {result} = renderHook((): HookController => useSignState())
  act(() => {
    result.current.setInput('text', 'message to sign')
  })

  await waitFor(() =>
    expect(signSpy).toHaveBeenCalledWith(
      expect.objectContaining({plaintext: 'message to sign'}),
      expect.anything()
    )
  )
  await waitFor(() => expect(result.current.state.output).toBe('signed:message to sign'))

  expect(result.current.state.outputValid).toBe(true)
  expect(result.current.state.errorMessage).toBe('')
})

test('verify auto-run uses the latest text snapshot and keeps output valid', async () => {
  const verifySpy = jest
    .spyOn(T.RPCGen, 'saltpackSaltpackVerifyStringRpcPromise')
    .mockImplementation(({signedMsg}) =>
      Promise.resolve({
        plaintext: `verified:${signedMsg}`,
        sender: {fullname: 'Bob', username: 'bob'},
        verified: true,
      } as never)
    )

  const {result} = renderHook((): HookController => useVerifyState())
  act(() => {
    result.current.setInput('text', 'signed payload')
  })

  await waitFor(() =>
    expect(verifySpy).toHaveBeenCalledWith(
      expect.objectContaining({signedMsg: 'signed payload'}),
      expect.anything()
    )
  )
  await waitFor(() => expect(result.current.state.output).toBe('verified:signed payload'))

  expect(result.current.state.outputValid).toBe(true)
  expect(result.current.state.errorMessage).toBe('')
})
