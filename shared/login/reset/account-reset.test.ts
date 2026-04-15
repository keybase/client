/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'

const mockStartProvision = jest.fn()

jest.mock('@/constants/router', () => {
  const actual = jest.requireActual('@/constants/router')
  return {
    ...actual,
    navUpToScreen: jest.fn(),
    navigateAppend: jest.fn(),
  }
})

jest.mock('@/stores/store-registry', () => ({
  storeRegistry: {
    getState: jest.fn(() => ({
      dispatch: {
        startProvision: mockStartProvision,
      },
    })),
  },
}))

import {enterResetPipeline, startAccountReset, submitResetPrompt} from './account-reset'

const {navigateAppend: mockNavigateAppend, navUpToScreen: mockNavUpToScreen} = require('@/constants/router') as {
  navigateAppend: jest.Mock
  navUpToScreen: jest.Mock
}

afterEach(() => {
  jest.restoreAllMocks()
  mockNavigateAppend.mockReset()
  mockNavUpToScreen.mockReset()
  mockStartProvision.mockReset()
  resetAllStores()
})

test('startAccountReset navigates into the reset flow', () => {
  startAccountReset(true, 'alice')

  expect(mockNavigateAppend).toHaveBeenCalledWith(
    {
      name: 'recoverPasswordPromptResetAccount',
      params: {skipPassword: true, username: 'alice'},
    },
    true
  )
})

test('enterResetPipeline exposes a submit handler for the confirm screen and starts provision on confirm', async () => {
  const result = jest.fn()

  jest.spyOn(T.RPCGen, 'accountEnterResetPipelineRpcListener').mockImplementation(listener => {
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

  enterResetPipeline({username: 'alice'})
  await Promise.resolve()

  const resetKey = mockNavigateAppend.mock.calls[mockNavigateAppend.mock.calls.length - 1]?.[0]?.params
    ?.resetKey as string
  expect(mockNavigateAppend).toHaveBeenCalledWith(
    {name: 'resetConfirm', params: {hasWallet: true, resetKey}},
    true
  )

  submitResetPrompt(resetKey, T.RPCGen.ResetPromptResponse.confirmReset)

  expect(result).toHaveBeenCalledWith(T.RPCGen.ResetPromptResponse.confirmReset)
  expect(mockStartProvision).toHaveBeenCalledWith('alice', true)
})

test('enterResetPipeline responds and starts the reset flow for non-complete prompts', async () => {
  const result = jest.fn()

  jest.spyOn(T.RPCGen, 'accountEnterResetPipelineRpcListener').mockImplementation(listener => {
    listener.customResponseIncomingCallMap?.['keybase.1.loginUi.promptResetAccount']?.(
      {
        prompt: {
          t: T.RPCGen.ResetPromptType.enterNoDevices,
        },
      } as any,
      {result} as any
    )
    return undefined as any
  })

  enterResetPipeline({username: 'alice'})
  await Promise.resolve()

  expect(result).toHaveBeenCalledWith(T.RPCGen.ResetPromptResponse.nothing)
  expect(mockNavigateAppend).toHaveBeenCalledWith(
    {
      name: 'recoverPasswordPromptResetAccount',
      params: {skipPassword: true, username: 'alice'},
    },
    true
  )
})

test('submitResetPrompt sends cancel responses back to the login flow', async () => {
  const result = jest.fn()

  jest.spyOn(T.RPCGen, 'accountEnterResetPipelineRpcListener').mockImplementation(listener => {
    listener.customResponseIncomingCallMap?.['keybase.1.loginUi.promptResetAccount']?.(
      {
        prompt: {
          complete: {hasWallet: false},
          t: T.RPCGen.ResetPromptType.complete,
        },
      } as any,
      {result} as any
    )
    return undefined as any
  })

  enterResetPipeline({username: 'alice'})
  await Promise.resolve()
  const resetKey = mockNavigateAppend.mock.calls[mockNavigateAppend.mock.calls.length - 1]?.[0]?.params
    ?.resetKey as string
  submitResetPrompt(resetKey, T.RPCGen.ResetPromptResponse.cancelReset)

  expect(result).toHaveBeenCalledWith(T.RPCGen.ResetPromptResponse.cancelReset)
  expect(mockNavUpToScreen).toHaveBeenCalledWith('login')
})

test('submitResetPrompt sends nothing responses back to the login flow', async () => {
  const result = jest.fn()

  jest.spyOn(T.RPCGen, 'accountEnterResetPipelineRpcListener').mockImplementation(listener => {
    listener.customResponseIncomingCallMap?.['keybase.1.loginUi.promptResetAccount']?.(
      {
        prompt: {
          complete: {hasWallet: false},
          t: T.RPCGen.ResetPromptType.complete,
        },
      } as any,
      {result} as any
    )
    return undefined as any
  })

  enterResetPipeline({username: 'alice'})
  await Promise.resolve()
  const resetKey = mockNavigateAppend.mock.calls[mockNavigateAppend.mock.calls.length - 1]?.[0]?.params
    ?.resetKey as string
  submitResetPrompt(resetKey, T.RPCGen.ResetPromptResponse.nothing)

  expect(result).toHaveBeenCalledWith(T.RPCGen.ResetPromptResponse.nothing)
  expect(mockNavUpToScreen).toHaveBeenCalledWith('login')
})
