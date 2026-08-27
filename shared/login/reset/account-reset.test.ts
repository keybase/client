/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {RPCError} from '@/util/errors'

const mockStartProvision = jest.fn()

jest.mock('@/constants/router', () => {
  const actual = jest.requireActual('@/constants/router')
  return {
    ...actual,
    navUpToScreen: jest.fn(),
    navigateAppend: jest.fn(),
  }
})

jest.mock('@/provision/flow', () => ({
  startProvision: (...args: Array<unknown>) => mockStartProvision(...args),
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

const flush = async () => new Promise<void>(resolve => setImmediate(resolve))

test('startAccountReset navigates into the reset flow', () => {
  startAccountReset(true, 'testuser')

  expect(mockNavigateAppend).toHaveBeenCalledWith(
    {
      name: 'recoverPasswordPromptResetAccount',
      params: {skipPassword: true, username: 'testuser'},
    },
    true
  )
})

test('enterResetPipeline exposes a submit handler for the confirm screen and starts provision on confirm', async () => {
  const result = jest.fn()
  let finishListener = () => {}

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
    await new Promise<void>(resolve => {
      finishListener = resolve
    })
    return undefined as any
  })

  try {
    enterResetPipeline({username: 'testuser'})
    await flush()

    const resetKey = mockNavigateAppend.mock.calls[mockNavigateAppend.mock.calls.length - 1]?.[0]?.params
      ?.resetKey as string
    expect(mockNavigateAppend).toHaveBeenCalledWith(
      {name: 'resetConfirm', params: {hasWallet: true, resetKey}},
      true
    )

    submitResetPrompt(resetKey, T.RPCGen.ResetPromptResponse.confirmReset)

    expect(result).toHaveBeenCalledWith(T.RPCGen.ResetPromptResponse.confirmReset)
    expect(mockStartProvision).toHaveBeenCalledWith('testuser', true)
  } finally {
    finishListener()
    await flush()
  }
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

  enterResetPipeline({username: 'testuser'})
  await Promise.resolve()

  expect(result).toHaveBeenCalledWith(T.RPCGen.ResetPromptResponse.nothing)
  expect(mockNavigateAppend).toHaveBeenCalledWith(
    {
      name: 'recoverPasswordPromptResetAccount',
      params: {skipPassword: true, username: 'testuser'},
    },
    true
  )
})

test('submitResetPrompt sends cancel responses back to the login flow', async () => {
  const result = jest.fn()
  let finishListener = () => {}

  jest.spyOn(T.RPCGen, 'accountEnterResetPipelineRpcListener').mockImplementation(async listener => {
    listener.customResponseIncomingCallMap?.['keybase.1.loginUi.promptResetAccount']?.(
      {
        prompt: {
          complete: {hasWallet: false},
          t: T.RPCGen.ResetPromptType.complete,
        },
      } as any,
      {result} as any
    )
    await new Promise<void>(resolve => {
      finishListener = resolve
    })
    return undefined as any
  })

  try {
    enterResetPipeline({username: 'testuser'})
    await flush()
    const resetKey = mockNavigateAppend.mock.calls[mockNavigateAppend.mock.calls.length - 1]?.[0]?.params
      ?.resetKey as string
    submitResetPrompt(resetKey, T.RPCGen.ResetPromptResponse.cancelReset)

    expect(result).toHaveBeenCalledWith(T.RPCGen.ResetPromptResponse.cancelReset)
    expect(mockNavUpToScreen).toHaveBeenCalledWith('login')
  } finally {
    finishListener()
    await flush()
  }
})

test('submitResetPrompt sends nothing responses back to the login flow', async () => {
  const result = jest.fn()
  let finishListener = () => {}

  jest.spyOn(T.RPCGen, 'accountEnterResetPipelineRpcListener').mockImplementation(async listener => {
    listener.customResponseIncomingCallMap?.['keybase.1.loginUi.promptResetAccount']?.(
      {
        prompt: {
          complete: {hasWallet: false},
          t: T.RPCGen.ResetPromptType.complete,
        },
      } as any,
      {result} as any
    )
    await new Promise<void>(resolve => {
      finishListener = resolve
    })
    return undefined as any
  })

  try {
    enterResetPipeline({username: 'testuser'})
    await flush()
    const resetKey = mockNavigateAppend.mock.calls[mockNavigateAppend.mock.calls.length - 1]?.[0]?.params
      ?.resetKey as string
    submitResetPrompt(resetKey, T.RPCGen.ResetPromptResponse.nothing)

    expect(result).toHaveBeenCalledWith(T.RPCGen.ResetPromptResponse.nothing)
    expect(mockNavUpToScreen).toHaveBeenCalledWith('login')
  } finally {
    finishListener()
    await flush()
  }
})

test('enterResetPipeline disposes an unconsumed reset prompt when the listener exits', async () => {
  const result = jest.fn()
  let finishListener = () => {}

  jest.spyOn(T.RPCGen, 'accountEnterResetPipelineRpcListener').mockImplementation(async listener => {
    listener.customResponseIncomingCallMap?.['keybase.1.loginUi.promptResetAccount']?.(
      {
        prompt: {
          complete: {hasWallet: false},
          t: T.RPCGen.ResetPromptType.complete,
        },
      } as any,
      {result} as any
    )
    await new Promise<void>(resolve => {
      finishListener = resolve
    })
    return undefined as any
  })

  enterResetPipeline({username: 'testuser'})
  await flush()

  const resetKey = mockNavigateAppend.mock.calls[mockNavigateAppend.mock.calls.length - 1]?.[0]?.params
    ?.resetKey as string
  finishListener()
  await flush()

  submitResetPrompt(resetKey, T.RPCGen.ResetPromptResponse.confirmReset)

  expect(result).not.toHaveBeenCalled()
  expect(mockStartProvision).not.toHaveBeenCalled()
})

test('reset progress before verification shows the check-your-email screen', async () => {
  jest.spyOn(T.RPCGen, 'accountEnterResetPipelineRpcListener').mockImplementation(listener => {
    listener.incomingCallMap['keybase.1.loginUi.displayResetProgress']?.(
      {endTime: 1700000000, needVerify: true, text: ''} as any
    )
    return undefined as any
  })

  enterResetPipeline({username: 'testuser'})
  await flush()

  expect(mockNavigateAppend).toHaveBeenCalledWith(
    {name: 'resetWaiting', params: {endTime: undefined, pipelineStarted: false, username: 'testuser'}},
    true
  )
})

test('reset progress after verification passes the countdown end time in milliseconds', async () => {
  jest.spyOn(T.RPCGen, 'accountEnterResetPipelineRpcListener').mockImplementation(listener => {
    listener.incomingCallMap['keybase.1.loginUi.displayResetProgress']?.(
      {endTime: 1700000000, needVerify: false, text: ''} as any
    )
    return undefined as any
  })

  enterResetPipeline({username: 'testuser'})
  await flush()

  expect(mockNavigateAppend).toHaveBeenCalledWith(
    {name: 'resetWaiting', params: {endTime: 1700000000000, pipelineStarted: true, username: 'testuser'}},
    true
  )
})

test('an rpc failure clears then reports the error to the caller', async () => {
  jest
    .spyOn(T.RPCGen, 'accountEnterResetPipelineRpcListener')
    .mockRejectedValue(new RPCError('nope', T.RPCGen.StatusCode.scbadloginpassword))
  const onError = jest.fn()

  enterResetPipeline({onError, username: 'testuser'})
  await flush()

  expect(onError).toHaveBeenNthCalledWith(1, '')
  expect(onError).toHaveBeenLastCalledWith('nope')
})

test('a non-rpc failure is not reported as a user facing error', async () => {
  jest.spyOn(T.RPCGen, 'accountEnterResetPipelineRpcListener').mockRejectedValue(new Error('boom'))
  const onError = jest.fn()

  enterResetPipeline({onError, username: 'testuser'})
  await flush()

  expect(onError).toHaveBeenCalledTimes(1)
  expect(onError).toHaveBeenCalledWith('')
})
