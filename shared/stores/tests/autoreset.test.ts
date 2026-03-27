/// <reference types="jest" />
import {resetAllStores} from '@/util/zustand'
import * as T from '@/constants/types'

jest.mock('@/constants/router', () => {
  const actual = jest.requireActual('@/constants/router')
  return {
    ...actual,
    navigateAppend: jest.fn(),
    navUpToScreen: jest.fn(),
  }
})

import {useAutoResetState} from '../autoreset'

const {navigateAppend: mockNavigateAppend, navUpToScreen: mockNavUpToScreen} = require('@/constants/router') as {
  navigateAppend: jest.Mock
  navUpToScreen: jest.Mock
}

afterEach(() => {
  jest.restoreAllMocks()
  mockNavigateAppend.mockReset()
  mockNavUpToScreen.mockReset()
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
    type: 'keybase.1.NotifyBadges.badgeState',
  } as any)

  expect(store.getState().active).toBe(false)
  expect(store.getState().endTime).toBe(5678)
})

test('startAccountReset seeds the account reset flow locally', () => {
  const store = useAutoResetState

  store.getState().dispatch.startAccountReset(true, 'alice')

  expect(store.getState().error).toBe('')
  expect(store.getState().active).toBe(false)
  expect(mockNavigateAppend).toHaveBeenCalledWith(
    {
      name: 'recoverPasswordPromptResetAccount',
      params: {skipPassword: true, username: 'alice'},
    },
    true
  )
})

test('resetAccount exposes a submit handler for the confirm screen and starts provision on confirm', async () => {
  const store = useAutoResetState
  const onStartProvision = jest.fn()
  const result = jest.fn()

  store.setState(s => ({
    ...s,
    dispatch: {
      ...s.dispatch,
      defer: {
        onStartProvision,
      },
    },
  }))

  jest.spyOn(T.RPCGen, 'accountEnterResetPipelineRpcListener').mockImplementation(async listener => {
    listener.customResponseIncomingCallMap?.['keybase.1.loginUi.promptResetAccount']?.(
      {
        prompt: {
          complete: {hasWallet: true},
          t: T.RPCGen.ResetPromptType.complete,
        },
      } as any,
      {result} as any
    )
    return undefined as any
  })

  store.getState().dispatch.resetAccount('alice')
  await Promise.resolve()

  expect(mockNavigateAppend).toHaveBeenCalledWith(
    {name: 'resetConfirm', params: {hasWallet: true}},
    true
  )

  store.getState().dispatch.dynamic.submitResetPrompt?.(T.RPCGen.ResetPromptResponse.confirmReset)

  expect(result).toHaveBeenCalledWith(T.RPCGen.ResetPromptResponse.confirmReset)
  expect(onStartProvision).toHaveBeenCalledWith('alice', true)
})
