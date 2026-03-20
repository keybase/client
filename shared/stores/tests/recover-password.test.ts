/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'

jest.mock('@/constants/router', () => {
  const actual = jest.requireActual('@/constants/router')
  return {
    ...actual,
    navigateAppend: jest.fn(),
    navigateUp: jest.fn(),
  }
})

import {useState as useRecoverPasswordState} from '../recover-password'

const {navigateAppend: mockNavigateAppend, navigateUp: mockNavigateUp} = require('@/constants/router') as {
  navigateAppend: jest.Mock
  navigateUp: jest.Mock
}

afterEach(() => {
  jest.restoreAllMocks()
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
    useRecoverPasswordState.getState().dispatch.startRecoverPassword({username: 'alice'})
    await flush()

    const state = useRecoverPasswordState.getState()
    expect(state.username).toBe('alice')
    expect(state.devices).toHaveLength(1)
    expect(state.dispatch.dynamic.submitDeviceSelect).toBeDefined()
    expect(state.dispatch.dynamic.cancel).toBeDefined()
    expect(mockNavigateAppend).toHaveBeenCalledWith('recoverPasswordDeviceSelector', false)

    state.dispatch.dynamic.submitDeviceSelect?.('phone')

    expect(chooserResponse?.result).toHaveBeenCalledWith(T.Devices.stringToDeviceID('device-1'))
    expect(useRecoverPasswordState.getState().dispatch.dynamic.submitDeviceSelect).toBeUndefined()
    expect(useRecoverPasswordState.getState().dispatch.dynamic.cancel).toBeUndefined()
  } finally {
    finishListener()
    await flush()
  }
})

test('resetState clears recover-password state after it has been populated', async () => {
  let finishListener = () => {}

  jest.spyOn(T.RPCGen, 'loginRecoverPassphraseRpcListener').mockImplementation(async listener => {
    const chooseDevice = listener.customResponseIncomingCallMap?.['keybase.1.loginUi.chooseDeviceToRecoverWith']
    if (!chooseDevice) {
      throw new Error('chooseDeviceToRecoverWith handler missing')
    }
    chooseDevice(
      {devices: [makeRpcDevice('tablet', 'device-2', 'desktop')]} as any,
      {error: jest.fn(), result: jest.fn()} as any
    )
    await new Promise<void>(resolve => {
      finishListener = resolve
    })
    return undefined as any
  })

  try {
    useRecoverPasswordState.getState().dispatch.startRecoverPassword({username: 'alice'})
    await flush()
    expect(useRecoverPasswordState.getState().devices).toHaveLength(1)

    useRecoverPasswordState.getState().dispatch.resetState?.()

    expect(useRecoverPasswordState.getState().username).toBe('')
    expect(useRecoverPasswordState.getState().devices).toHaveLength(0)
    expect(useRecoverPasswordState.getState().error).toBe('')
    expect(useRecoverPasswordState.getState().dispatch.dynamic.submitDeviceSelect).toBeUndefined()
  } finally {
    finishListener()
    await flush()
  }
})
