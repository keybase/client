/** @jest-environment jsdom */
/// <reference types="jest" />
import {act, cleanup, renderHook, waitFor} from '@testing-library/react'
import * as T from '@/constants/types'
import {notifyEngineActionListeners} from '@/engine/action-listener'
import {resetAllStores} from '@/util/zustand'
import {useRandomPWState} from './use-random-pw'

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

test('loads passphrase state on mount and can reload on demand', async () => {
  const loadPassphraseState = jest
    .spyOn(T.RPCGen, 'userLoadPassphraseStateRpcPromise')
    .mockResolvedValue(T.RPCGen.PassphraseState.random)

  const {result} = renderHook(() => useRandomPWState())

  await waitFor(() => expect(result.current.randomPW).toBe(true))
  expect(loadPassphraseState).toHaveBeenCalledTimes(1)

  act(() => {
    result.current.reload()
  })

  await waitFor(() => expect(loadPassphraseState).toHaveBeenCalledTimes(2))
})

test('notification updates beat stale load results', async () => {
  let resolveLoad: ((state: T.RPCGen.PassphraseState) => void) | undefined
  const loadPassphraseState = jest.spyOn(T.RPCGen, 'userLoadPassphraseStateRpcPromise').mockImplementation(
    () =>
      new Promise<T.RPCGen.PassphraseState>(resolve => {
        resolveLoad = resolve
      })
  )

  const {result} = renderHook(() => useRandomPWState())

  await waitFor(() => expect(loadPassphraseState).toHaveBeenCalledTimes(1))

  act(() => {
    notifyEngineActionListeners({
      payload: {params: {state: T.RPCGen.PassphraseState.known}},
      type: 'keybase.1.NotifyUsers.passwordChanged',
    } as never)
  })

  await waitFor(() => expect(result.current.randomPW).toBe(false))

  act(() => {
    resolveLoad?.(T.RPCGen.PassphraseState.random)
  })

  await waitFor(() => expect(result.current.randomPW).toBe(false))
})
