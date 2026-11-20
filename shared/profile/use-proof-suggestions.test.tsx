/** @jest-environment jsdom */
/// <reference types="jest" />
import {act, cleanup, renderHook} from '@testing-library/react'
import type * as T from '@/constants/types'
import {notifyEngineActionListeners} from '@/engine/action-listener'
import {useCurrentUserState} from '@/stores/current-user'
import {installFakeEngine} from '@/test/fake-engine'
import {flush} from '@/test/flush'
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

const proofSuggestions = 'keybase.1.user.proofSuggestions'

const asUser = (uid: string) =>
  useCurrentUserState.getState().dispatch.setBootstrap({deviceID: '', deviceName: '', uid, username: 'alice'})

const userChanged = (uid: string) =>
  act(() => {
    notifyEngineActionListeners({
      payload: {params: {uid}},
      type: 'keybase.1.NotifyUsers.userChanged',
    } as never)
  })

afterEach(() => {
  cleanup()
  resetAllStores()
})

test('loads suggestions on mount and reloads only for the current user', async () => {
  asUser('uid-1')
  const fake = installFakeEngine()
  let response = makeResponse([makeSuggestion('github')])
  fake.answer(proofSuggestions, () => response)

  const {result} = renderHook(() => useProofSuggestions())
  await flush()
  expect(result.current.proofSuggestions[0]?.assertionKey).toBe('github')
  expect(fake.calls).toHaveLength(1)

  response = makeResponse([makeSuggestion('twitter', true)])
  userChanged('uid-2')
  await flush()
  expect(fake.calls).toHaveLength(1)

  userChanged('uid-1')
  await flush()
  expect(fake.calls).toHaveLength(2)
  expect(result.current.proofSuggestions[0]?.assertionKey).toBe('twitter')
})

test('newer reloads beat stale proof suggestion results', async () => {
  asUser('uid-1')
  const fake = installFakeEngine()
  const held = fake.hold(proofSuggestions)

  const {result} = renderHook(() => useProofSuggestions())
  await flush()
  expect(held).toHaveLength(1)

  act(() => {
    result.current.reload()
  })
  await flush()
  expect(held).toHaveLength(2)

  held[0]!.reply(makeResponse([makeSuggestion('github')]))
  held[1]!.reply(makeResponse([makeSuggestion('reddit')]))
  await flush()
  expect(result.current.proofSuggestions[0]?.assertionKey).toBe('reddit')
})

test('a burst of user changes loads once more after the load in flight, not once per notice', async () => {
  asUser('uid-1')
  const fake = installFakeEngine()
  const held = fake.hold(proofSuggestions)

  const {result} = renderHook(() => useProofSuggestions())
  await flush()
  expect(held).toHaveLength(1)

  for (let i = 0; i < 5; i++) {
    userChanged('uid-1')
  }
  await flush()
  expect(held).toHaveLength(1)

  held[0]!.reply(makeResponse([makeSuggestion('github')]))
  await flush()
  expect(held).toHaveLength(2)

  held[1]!.reply(makeResponse([makeSuggestion('reddit')]))
  await flush()
  expect(result.current.proofSuggestions[0]?.assertionKey).toBe('reddit')
  expect(held).toHaveLength(2)
})
