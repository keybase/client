/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {usePeopleState} from '../people'

beforeEach(() => {
  resetAllStores()
})

afterEach(() => {
  jest.restoreAllMocks()
  resetAllStores()
})

test('markViewed forwards to the home mark-viewed RPC', async () => {
  const markViewedSpy = jest.spyOn(T.RPCGen, 'homeHomeMarkViewedRpcPromise').mockResolvedValue(undefined)

  usePeopleState.getState().dispatch.markViewed()
  await Promise.resolve()

  expect(markViewedSpy).toHaveBeenCalledTimes(1)
})

test('resetState clears the refresh counter', () => {
  usePeopleState.setState({refreshCount: 2} as never)

  usePeopleState.getState().dispatch.resetState()

  expect(usePeopleState.getState().refreshCount).toBe(0)
})

test('homeUIRefresh increments the refresh counter', () => {
  usePeopleState.getState().dispatch.onEngineIncomingImpl({
    payload: {params: {}},
    type: 'keybase.1.homeUI.homeUIRefresh',
  } as never)

  expect(usePeopleState.getState().refreshCount).toBe(1)
})
