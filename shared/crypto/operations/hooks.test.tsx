/** @jest-environment jsdom */
/// <reference types="jest" />

import {afterEach, beforeEach, expect, jest, test} from '@jest/globals'
import * as React from 'react'
import {act, cleanup, render, waitFor} from '@testing-library/react'
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

const mountHook = <Controller extends HookController>(useHook: () => Controller) => {
  let latest: Controller | undefined

  const Probe = () => {
    latest = useHook()
    return null
  }

  render(<Probe />)
  return () => {
    if (!latest) {
      throw new Error('Hook controller did not mount')
    }
    return latest
  }
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
    .mockImplementation(async ({plaintext}) => ({
      ciphertext: `cipher:${plaintext}`,
      unresolvedSBSAssertion: '',
      usedUnresolvedSBS: false,
    }) as never)

  const getController = mountHook(() => useEncryptScreenState())
  await act(async () => {
    getController().setInput('text', 'secret message')
  })

  await waitFor(() =>
    expect(encryptSpy).toHaveBeenCalledWith(
      expect.objectContaining({plaintext: 'secret message'}),
      expect.anything()
    )
  )
  await waitFor(() => expect(getController().state.output).toBe('cipher:secret message'))

  expect(getController().state.outputValid).toBe(true)
  expect(getController().state.errorMessage).toBe('')
})

test('decrypt auto-run uses the pasted ciphertext instead of the previous input', async () => {
  const decryptSpy = jest
    .spyOn(T.RPCGen, 'saltpackSaltpackDecryptStringRpcPromise')
    .mockImplementation(async ({ciphertext}) => ({
      info: {sender: {fullname: 'Bob', username: 'bob'}},
      plaintext: `plain:${ciphertext}`,
      signed: true,
    }) as never)

  const getController = mountHook(() => useDecryptState())
  await act(async () => {
    getController().setInput('text', 'encrypted payload')
  })

  await waitFor(() =>
    expect(decryptSpy).toHaveBeenCalledWith(
      expect.objectContaining({ciphertext: 'encrypted payload'}),
      expect.anything()
    )
  )
  await waitFor(() => expect(getController().state.output).toBe('plain:encrypted payload'))

  expect(getController().state.outputValid).toBe(true)
  expect(getController().state.errorMessage).toBe('')
})

test('sign auto-run uses the latest text snapshot and keeps output valid', async () => {
  const signSpy = jest
    .spyOn(T.RPCGen, 'saltpackSaltpackSignStringRpcPromise')
    .mockImplementation(async ({plaintext}) => `signed:${plaintext}` as never)

  const getController = mountHook(() => useSignState())
  await act(async () => {
    getController().setInput('text', 'message to sign')
  })

  await waitFor(() =>
    expect(signSpy).toHaveBeenCalledWith(
      expect.objectContaining({plaintext: 'message to sign'}),
      expect.anything()
    )
  )
  await waitFor(() => expect(getController().state.output).toBe('signed:message to sign'))

  expect(getController().state.outputValid).toBe(true)
  expect(getController().state.errorMessage).toBe('')
})

test('verify auto-run uses the latest text snapshot and keeps output valid', async () => {
  const verifySpy = jest
    .spyOn(T.RPCGen, 'saltpackSaltpackVerifyStringRpcPromise')
    .mockImplementation(async ({signedMsg}) => ({
      plaintext: `verified:${signedMsg}`,
      sender: {fullname: 'Bob', username: 'bob'},
      verified: true,
    }) as never)

  const getController = mountHook(() => useVerifyState())
  await act(async () => {
    getController().setInput('text', 'signed payload')
  })

  await waitFor(() =>
    expect(verifySpy).toHaveBeenCalledWith(
      expect.objectContaining({signedMsg: 'signed payload'}),
      expect.anything()
    )
  )
  await waitFor(() => expect(getController().state.output).toBe('verified:signed payload'))

  expect(getController().state.outputValid).toBe(true)
  expect(getController().state.errorMessage).toBe('')
})
