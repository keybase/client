/** @jest-environment jsdom */
/// <reference types="jest" />
import {act, cleanup, renderHook, waitFor} from '@testing-library/react'
import * as T from '@/constants/types'
import {notifyEngineActionListeners} from '@/engine/action-listener'
import {useCurrentUserState} from '@/stores/current-user'
import {resetAllStores} from '@/util/zustand'
import {useProofSuggestions} from './use-proof-suggestions'

const makeSuggestion = (key: string, belowFold = false): T.RPCGen.ProofSuggestion =>
  ({
    belowFold,
    key,
    metas: [],
    pickerIcon: [],
    pickerIconDarkmode: [],
    pickerSubtext: `${key} subtext`,
    pickerText: key,
    profileIcon: [],
    profileIconDarkmode: [],
    profileText: `${key}-user`,
  }) as never

const makeResponse = (
  suggestions: Array<T.RPCGen.ProofSuggestion>
): T.RPCGen.ProofSuggestionsRes => ({
  showMore: false,
  suggestions,
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

test('loads suggestions on mount and reloads only for the current user', async () => {
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: '',
    deviceName: '',
    uid: 'uid-1',
    username: 'alice',
  })

  const loadSuggestions = jest
    .spyOn(T.RPCGen, 'userProofSuggestionsRpcPromise')
    .mockResolvedValueOnce(makeResponse([makeSuggestion('github')]))
    .mockResolvedValueOnce(makeResponse([makeSuggestion('twitter', true)]))

  const {result} = renderHook(() => useProofSuggestions())

  await waitFor(() => expect(result.current.proofSuggestions[0]?.assertionKey).toBe('github'))
  expect(loadSuggestions).toHaveBeenCalledTimes(1)

  act(() => {
    notifyEngineActionListeners({
      payload: {params: {uid: 'uid-2'}},
      type: 'keybase.1.NotifyUsers.userChanged',
    } as never)
  })

  expect(loadSuggestions).toHaveBeenCalledTimes(1)

  act(() => {
    notifyEngineActionListeners({
      payload: {params: {uid: 'uid-1'}},
      type: 'keybase.1.NotifyUsers.userChanged',
    } as never)
  })

  await waitFor(() => expect(loadSuggestions).toHaveBeenCalledTimes(2))
  await waitFor(() => expect(result.current.proofSuggestions[0]?.assertionKey).toBe('twitter'))
})

test('newer reloads beat stale proof suggestion results', async () => {
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: '',
    deviceName: '',
    uid: 'uid-1',
    username: 'alice',
  })

  const pending: Array<(value: T.RPCGen.ProofSuggestionsRes) => void> = []
  const loadSuggestions = jest.spyOn(T.RPCGen, 'userProofSuggestionsRpcPromise').mockImplementation(
    async () =>
      new Promise(resolve => {
        pending.push(resolve)
      })
  )

  const {result} = renderHook(() => useProofSuggestions())

  await waitFor(() => expect(loadSuggestions).toHaveBeenCalledTimes(1))

  act(() => {
    notifyEngineActionListeners({
      payload: {params: {uid: 'uid-1'}},
      type: 'keybase.1.NotifyUsers.userChanged',
    } as never)
  })

  await waitFor(() => expect(loadSuggestions).toHaveBeenCalledTimes(2))

  act(() => {
    pending[0]?.(makeResponse([makeSuggestion('github')]))
    pending[1]?.(makeResponse([makeSuggestion('reddit')]))
  })

  await waitFor(() => expect(result.current.proofSuggestions[0]?.assertionKey).toBe('reddit'))
})
