/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'

import {usePWState} from '../settings-password'

afterEach(() => {
  jest.restoreAllMocks()
  resetAllStores()
})

const flush = async () => new Promise<void>(resolve => setImmediate(resolve))

test('loadHasRandomPw caches the loaded state', async () => {
  const loadPassphraseState = jest
    .spyOn(T.RPCGen, 'userLoadPassphraseStateRpcPromise')
    .mockResolvedValue(T.RPCGen.PassphraseState.random)

  usePWState.getState().dispatch.loadHasRandomPw()
  await flush()
  usePWState.getState().dispatch.loadHasRandomPw()
  await flush()

  expect(usePWState.getState().randomPW).toBe(true)
  expect(loadPassphraseState).toHaveBeenCalledTimes(1)
})

test('notifyUsersPasswordChanged overwrites the cached state', () => {
  usePWState.getState().dispatch.notifyUsersPasswordChanged(true)
  expect(usePWState.getState().randomPW).toBe(true)

  usePWState.getState().dispatch.notifyUsersPasswordChanged(false)
  expect(usePWState.getState().randomPW).toBe(false)
})
