import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useState as useRecoverPasswordState} from '../recover-password'

const mockNavigateAppend = jest.fn()
const mockNavigateUp = jest.fn()

jest.mock('@/constants/router', () => {
    const actual = jest.requireActual('@/constants/router')
    return {
      ...actual,
      navigateAppend: mockNavigateAppend,
      navigateUp: mockNavigateUp,
    }
})

afterEach(() => {
  jest.restoreAllMocks()
  mockNavigateAppend.mockReset()
  mockNavigateUp.mockReset()
  resetAllStores()
})

const flush = () => new Promise<void>(resolve => setImmediate(resolve))

const makeRpcDevice = (name: string, deviceID: string, type: T.RPCGen.DeviceType) =>
  ({
    deviceID,
    deviceNumberOfType: 1,
    name,
    type,
  }) as any

test('startRecoverPassword exposes device selection handlers', async () => {
  let chooserResponse: {error: jest.Mock; result: jest.Mock} | undefined

  jest.spyOn(T.RPCGen, 'loginRecoverPassphraseRpcListener').mockImplementation(async listener => {
    chooserResponse = {error: jest.fn(), result: jest.fn()}
    listener.customResponseIncomingCallMap['keybase.1.loginUi.chooseDeviceToRecoverWith'](
      {devices: [makeRpcDevice('phone', 'device-1', T.RPCGen.DeviceType.mobile)]} as any,
      chooserResponse as any
    )
    return undefined as any
  })

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
})

test('resetState clears recover-password state after it has been populated', async () => {
  jest.spyOn(T.RPCGen, 'loginRecoverPassphraseRpcListener').mockImplementation(async listener => {
    listener.customResponseIncomingCallMap['keybase.1.loginUi.chooseDeviceToRecoverWith'](
      {devices: [makeRpcDevice('tablet', 'device-2', T.RPCGen.DeviceType.desktop)]} as any,
      {error: jest.fn(), result: jest.fn()} as any
    )
    return undefined as any
  })

  useRecoverPasswordState.getState().dispatch.startRecoverPassword({username: 'alice'})
  await flush()
  expect(useRecoverPasswordState.getState().devices).toHaveLength(1)

  useRecoverPasswordState.getState().dispatch.resetState()

  expect(useRecoverPasswordState.getState().username).toBe('')
  expect(useRecoverPasswordState.getState().devices).toHaveLength(0)
  expect(useRecoverPasswordState.getState().error).toBe('')
  expect(useRecoverPasswordState.getState().dispatch.dynamic.submitDeviceSelect).toBeUndefined()
})
