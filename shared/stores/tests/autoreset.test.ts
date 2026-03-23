/// <reference types="jest" />
import * as EngineGen from '@/constants/rpc'
import {resetAllStores} from '@/util/zustand'
import {useAutoResetState} from '../autoreset'

afterEach(() => {
  jest.restoreAllMocks()
  resetAllStores()
})

test('updateARState and badge updates keep the reset state in sync', () => {
  const store = useAutoResetState

  store.getState().dispatch.updateARState(true, 1234)
  expect(store.getState().active).toBe(true)
  expect(store.getState().endTime).toBe(1234)

  store.getState().dispatch.onEngineIncomingImpl({
    payload: {
      params: {
        badgeState: {
          resetState: {
            active: false,
            endTime: 5678,
          },
        },
      },
    },
    type: EngineGen.keybase1NotifyBadgesBadgeState,
  } as any)

  expect(store.getState().active).toBe(false)
  expect(store.getState().endTime).toBe(5678)
})

test('startAccountReset seeds the account reset flow locally', () => {
  const store = useAutoResetState

  store.getState().dispatch.startAccountReset(true, 'alice')

  expect(store.getState().skipPassword).toBe(true)
  expect(store.getState().username).toBe('alice')
  expect(store.getState().error).toBe('')
  expect(store.getState().active).toBe(false)
})
