/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'

jest.mock('@/constants/router', () => {
  const actual = jest.requireActual('@/constants/router')
  return {
    ...actual,
    clearModals: jest.fn(),
    navigateAppend: jest.fn(),
    navigateUp: jest.fn(),
  }
})

import {
  startRecoverPassword,
  submitRecoverPasswordDeviceSelect,
  submitRecoverPasswordReset,
} from './flow'

const {
  clearModals: mockClearModals,
  navigateAppend: mockNavigateAppend,
  navigateUp: mockNavigateUp,
} = require('@/constants/router') as {
  clearModals: jest.Mock
  navigateAppend: jest.Mock
  navigateUp: jest.Mock
}

afterEach(() => {
  jest.restoreAllMocks()
  mockClearModals.mockReset()
  mockNavigateAppend.mockReset()
  mockNavigateUp.mockReset()
  resetAllStores()
})

const flush = async () => new Promise<void>(resolve => setImmediate(resolve))

const makeRpcDevice = (name: string, deviceID: string, type: 'mobile' | 'desktop' | 'backup') =>
  ({
    deviceID,
    deviceNumberOfType: 1,
    name,
    type,
  }) as any

test('startRecoverPassword exposes device selection handlers', async () => {
  let chooserResponse: {error: jest.Mock; result: jest.Mock} | undefined
  let finishListener = () => {}

  jest.spyOn(T.RPCGen, 'loginRecoverPassphraseRpcListener').mockImplementation(async listener => {
    chooserResponse = {error: jest.fn(), result: jest.fn()}
    const chooseDevice = listener.customResponseIncomingCallMap?.['keybase.1.loginUi.chooseDeviceToRecoverWith']
    if (!chooseDevice) {
      throw new Error('chooseDeviceToRecoverWith handler missing')
    }
    chooseDevice(
      {devices: [makeRpcDevice('phone', 'device-1', 'mobile')]} as any,
      chooserResponse as any
    )
    await new Promise<void>(resolve => {
      finishListener = resolve
    })
    return undefined as any
  })

  try {
    startRecoverPassword({username: 'alice'})
    await flush()

    expect(mockNavigateAppend).toHaveBeenCalledWith(
      {
        name: 'recoverPasswordDeviceSelector',
        params: {
          devices: [
            expect.objectContaining({
              id: T.Devices.stringToDeviceID('device-1'),
              name: 'phone',
              type: 'mobile',
            }),
          ],
        },
      },
      false
    )

    submitRecoverPasswordDeviceSelect(T.Devices.stringToDeviceID('device-1'))
    submitRecoverPasswordDeviceSelect(T.Devices.stringToDeviceID('device-1'))

    expect(chooserResponse?.result).toHaveBeenCalledTimes(1)
    expect(chooserResponse?.result).toHaveBeenCalledWith(T.Devices.stringToDeviceID('device-1'))
  } finally {
    finishListener()
    await flush()
  }
})

test('resetAllStores clears pending recover-password handlers', async () => {
  let chooserResponse: {error: jest.Mock; result: jest.Mock} | undefined
  let finishListener = () => {}

  jest.spyOn(T.RPCGen, 'loginRecoverPassphraseRpcListener').mockImplementation(async listener => {
    chooserResponse = {error: jest.fn(), result: jest.fn()}
    const chooseDevice = listener.customResponseIncomingCallMap?.['keybase.1.loginUi.chooseDeviceToRecoverWith']
    if (!chooseDevice) {
      throw new Error('chooseDeviceToRecoverWith handler missing')
    }
    chooseDevice(
      {devices: [makeRpcDevice('tablet', 'device-2', 'desktop')]} as any,
      chooserResponse as any
    )
    await new Promise<void>(resolve => {
      finishListener = resolve
    })
    return undefined as any
  })

  try {
    startRecoverPassword({username: 'alice'})
    await flush()

    resetAllStores()
    submitRecoverPasswordDeviceSelect(T.Devices.stringToDeviceID('device-2'))

    expect(chooserResponse?.result).not.toHaveBeenCalled()
  } finally {
    finishListener()
    await flush()
  }
})

test('reset-password prompt resolves callback and local banner handler', async () => {
  let promptResponse: {result: jest.Mock} | undefined
  let finishListener = () => {}
  const onResetEmailSent = jest.fn()

  jest.spyOn(T.RPCGen, 'loginRecoverPassphraseRpcListener').mockImplementation(async listener => {
    promptResponse = {result: jest.fn()}
    const promptReset = listener.customResponseIncomingCallMap?.['keybase.1.loginUi.promptResetAccount']
    if (!promptReset) {
      throw new Error('promptResetAccount handler missing')
    }
    promptReset(
      {prompt: {t: T.RPCGen.ResetPromptType.enterResetPw}} as any,
      promptResponse as any
    )
    await new Promise<void>(resolve => {
      finishListener = resolve
    })
    return undefined as any
  })

  try {
    startRecoverPassword({onResetEmailSent, username: 'alice'})
    await flush()

    expect(mockNavigateAppend).toHaveBeenCalledWith({
      name: 'recoverPasswordPromptResetPassword',
      params: {username: 'alice'},
    })

    submitRecoverPasswordReset(T.RPCGen.ResetPromptResponse.confirmReset)
    submitRecoverPasswordReset(T.RPCGen.ResetPromptResponse.confirmReset)

    expect(promptResponse?.result).toHaveBeenCalledTimes(1)
    expect(promptResponse?.result).toHaveBeenCalledWith(T.RPCGen.ResetPromptResponse.confirmReset)
    expect(onResetEmailSent).toHaveBeenCalledTimes(1)
    expect(mockNavigateUp).toHaveBeenCalledTimes(1)
  } finally {
    finishListener()
    await flush()
  }
})
