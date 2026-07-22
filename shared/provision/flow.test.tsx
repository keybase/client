/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {RPCError} from '@/util/errors'

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
  cancelProvision,
  pauseProvision,
  startAddNewDevice,
  submitProvisionDeviceName,
  submitProvisionDeviceSelect,
  submitProvisionUsername,
  startProvision,
} from './flow'

const {clearModals: mockClearModals, navigateAppend: mockNavigateAppend} = require('@/constants/router') as {
  clearModals: jest.Mock
  navigateAppend: jest.Mock
}

afterEach(() => {
  cancelProvision()
  jest.restoreAllMocks()
  mockClearModals.mockReset()
  mockNavigateAppend.mockReset()
  resetAllStores()
})

const flush = async () => new Promise<void>(resolve => setImmediate(resolve))

type Listener = Parameters<typeof T.RPCGen.loginLoginRpcListener>[0]

const makeRpcDevice = (name: string, deviceID: string, type: 'mobile' | 'desktop' | 'backup') =>
  ({
    deviceID,
    deviceNumberOfType: 1,
    name,
    type,
  }) as any

// Each loginLogin call hangs until the test rejects/resolves it, like the real RPC waiting on prompts.
// onSessionCreated is honored: cancel() rejects the attempt like the engine's client-side session cancel.
const mockLoginAttempts = () => {
  const attempts: Array<{
    listener: Listener
    reject: (e: unknown) => void
    resolve: () => void
    cancel?: () => void
  }> = []
  jest.spyOn(T.RPCGen, 'loginLoginRpcListener').mockImplementation(async listener => {
    await new Promise<void>((resolve, reject) => {
      const attempt = {listener, reject, resolve} as (typeof attempts)[number]
      listener.onSessionCreated?.(() => {
        attempt.cancel?.()
        attempt.reject(new RPCError('Received RPC cancel for session', T.RPCGen.StatusCode.sccanceled))
      })
      attempts.push(attempt)
    })
    return undefined as any
  })
  return attempts
}

test('startProvision navigates to the username screen', () => {
  startProvision('alice', true)
  expect(mockNavigateAppend).toHaveBeenCalledWith({
    name: 'username',
    params: {fromReset: true, username: 'alice'},
  })
})

test('chooseDevice prompt navigates with devices and the selection resolves once', async () => {
  const attempts = mockLoginAttempts()

  submitProvisionUsername('alice')
  await flush()
  expect(attempts.length).toBe(1)

  const response = {error: jest.fn(), result: jest.fn()}
  attempts[0]!.listener.customResponseIncomingCallMap?.['keybase.1.provisionUi.chooseDevice']?.(
    {devices: [makeRpcDevice('phone', 'device-1', 'mobile')]} as any,
    response as any
  )

  expect(mockNavigateAppend).toHaveBeenCalledWith({
    name: 'selectOtherDevice',
    params: {
      devices: [
        expect.objectContaining({
          id: T.Devices.stringToDeviceID('device-1'),
          name: 'phone',
          type: 'mobile',
        }),
      ],
      username: 'alice',
    },
  })

  submitProvisionDeviceSelect('phone')
  submitProvisionDeviceSelect('phone')

  expect(response.result).toHaveBeenCalledTimes(1)
  expect(response.result).toHaveBeenCalledWith(T.Devices.stringToDeviceID('device-1'))

  attempts[0]!.resolve()
  await flush()
})

test('changing an earlier answer restarts the RPC and replays recorded answers', async () => {
  const attempts = mockLoginAttempts()

  submitProvisionUsername('alice')
  await flush()
  expect(attempts.length).toBe(1)
  const attempt1 = attempts[0]!

  // first attempt prompts for a device name; the user answers
  const nameResponse1 = {error: jest.fn(), result: jest.fn()}
  attempt1.listener.customResponseIncomingCallMap?.['keybase.1.provisionUi.PromptNewDeviceName']?.(
    {errorMessage: ''} as any,
    nameResponse1 as any
  )
  expect(mockNavigateAppend).toHaveBeenCalledWith(
    {name: 'setPublicName', params: {devices: [], error: undefined}},
    false
  )
  submitProvisionDeviceName('dev1')
  expect(nameResponse1.result).toHaveBeenCalledWith('dev1')

  // then prompts for a password
  const passphraseResponse = {
    error: jest.fn(() => {
      attempt1.reject(new RPCError('Input canceled', T.RPCGen.StatusCode.scinputcanceled))
    }),
    result: jest.fn(),
  }
  attempt1.listener.customResponseIncomingCallMap?.['keybase.1.secretUi.getPassphrase']?.(
    {pinentry: {retryLabel: '', type: T.RPCGen.PassphraseType.passPhrase}} as any,
    passphraseResponse as any
  )
  expect(mockNavigateAppend).toHaveBeenCalledWith(
    {name: 'password', params: {error: undefined, username: 'alice'}},
    false
  )

  // the user goes back and submits a different device name: the pending password
  // prompt is cancelled and the RPC restarts
  submitProvisionDeviceName('dev2')
  expect(passphraseResponse.error).toHaveBeenCalled()
  await flush()
  expect(attempts.length).toBe(2)
  const attempt2 = attempts[1]!

  // the device name prompt in the new attempt is auto-submitted with the new answer
  mockNavigateAppend.mockClear()
  const nameResponse2 = {error: jest.fn(), result: jest.fn()}
  attempt2.listener.customResponseIncomingCallMap?.['keybase.1.provisionUi.PromptNewDeviceName']?.(
    {errorMessage: ''} as any,
    nameResponse2 as any
  )
  expect(nameResponse2.result).toHaveBeenCalledWith('dev2')
  expect(mockNavigateAppend).not.toHaveBeenCalled()

  attempt2.resolve()
  await flush()
})

test('a cancelled add-device run does not clear modals out from under a retry', async () => {
  type AddListener = Parameters<typeof T.RPCGen.deviceDeviceAddRpcListener>[0]
  const attempts: Array<{
    listener: AddListener
    reject: (e: unknown) => void
    resolve: () => void
  }> = []
  jest.spyOn(T.RPCGen, 'deviceDeviceAddRpcListener').mockImplementation(async listener => {
    await new Promise<void>((resolve, reject) => {
      attempts.push({listener, reject, resolve})
    })
    return undefined as any
  })

  startAddNewDevice('mobile')
  await flush()
  expect(attempts.length).toBe(1)
  const attempt1 = attempts[0]!

  const response1 = {
    error: jest.fn(() => {
      attempt1.reject(new RPCError('Input canceled', T.RPCGen.StatusCode.scinputcanceled))
    }),
    result: jest.fn(),
  }
  attempt1.listener.customResponseIncomingCallMap?.['keybase.1.provisionUi.DisplayAndPromptSecret']?.(
    {phrase: 'one two three', previousErr: ''} as any,
    response1 as any
  )
  expect(mockNavigateAppend).toHaveBeenCalledWith(
    expect.objectContaining({name: 'codePage'}),
    false
  )

  // the user cancels, then tries again: the dead run must not clear modals or eat the new run's UI
  startAddNewDevice('mobile')
  expect(response1.error).toHaveBeenCalled()
  await flush()
  expect(mockClearModals).not.toHaveBeenCalled()
  expect(attempts.length).toBe(2)
  const attempt2 = attempts[1]!

  mockNavigateAppend.mockClear()
  const response2 = {error: jest.fn(), result: jest.fn()}
  attempt2.listener.customResponseIncomingCallMap?.['keybase.1.provisionUi.DisplayAndPromptSecret']?.(
    {phrase: 'four five six', previousErr: ''} as any,
    response2 as any
  )
  expect(mockNavigateAppend).toHaveBeenCalledWith(
    expect.objectContaining({name: 'codePage'}),
    false
  )
  expect(response2.error).not.toHaveBeenCalled()

  attempt2.resolve()
  await flush()
  // the successful run still clears modals when it finishes
  expect(mockClearModals).toHaveBeenCalled()
})

test('cancel before any prompt kills the RPC at its first prompt', async () => {
  type AddListener = Parameters<typeof T.RPCGen.deviceDeviceAddRpcListener>[0]
  let listener: AddListener | undefined
  let finishListener: (e?: Error) => void = () => {}
  jest.spyOn(T.RPCGen, 'deviceDeviceAddRpcListener').mockImplementation(async l => {
    listener = l
    await new Promise<void>((resolve, reject) => {
      finishListener = (e?: Error) => (e ? reject(e) : resolve())
    })
    return undefined as any
  })

  startAddNewDevice('mobile')
  await flush()

  // user cancels while the service is still working, before any prompt
  cancelProvision()

  const response = {error: jest.fn(), result: jest.fn()}
  listener?.customResponseIncomingCallMap?.['keybase.1.provisionUi.DisplayAndPromptSecret']?.(
    {phrase: 'one two three', previousErr: ''} as any,
    response as any
  )
  expect(response.error).toHaveBeenCalled()
  expect(mockNavigateAppend).not.toHaveBeenCalledWith(expect.objectContaining({name: 'codePage'}), false)

  finishListener(new RPCError('Input canceled', T.RPCGen.StatusCode.scinputcanceled))
  await flush()
  expect(mockClearModals).not.toHaveBeenCalled()
})

test('pause during server work cancels the attempt and parks the run', async () => {
  const attempts = mockLoginAttempts()

  submitProvisionUsername('alice')
  await flush()
  expect(attempts.length).toBe(1)

  // no prompt pending: the service is mid-work (or hung)
  pauseProvision()
  await flush()

  // parked: no restart, no error navigation
  expect(attempts.length).toBe(1)
  expect(mockNavigateAppend).not.toHaveBeenCalledWith(expect.objectContaining({name: 'error'}), true)
})

test('resubmit while parked restarts and replays recorded answers', async () => {
  const attempts = mockLoginAttempts()

  submitProvisionUsername('alice')
  await flush()
  const attempt1 = attempts[0]!

  // answer the device-name prompt, then the service hangs before the next prompt
  const nameResponse = {error: jest.fn(), result: jest.fn()}
  attempt1.listener.customResponseIncomingCallMap?.['keybase.1.provisionUi.PromptNewDeviceName']?.(
    {errorMessage: ''} as any,
    nameResponse as any
  )
  submitProvisionDeviceName('dev1')
  expect(nameResponse.result).toHaveBeenCalledWith('dev1')

  pauseProvision()
  await flush()
  expect(attempts.length).toBe(1)

  // user resubmits from the (still-mounted) device name screen
  submitProvisionDeviceName('dev2')
  await flush()
  expect(attempts.length).toBe(2)

  // the new attempt auto-submits the replayed answer without navigating
  mockNavigateAppend.mockClear()
  const nameResponse2 = {error: jest.fn(), result: jest.fn()}
  attempts[1]!.listener.customResponseIncomingCallMap?.['keybase.1.provisionUi.PromptNewDeviceName']?.(
    {errorMessage: ''} as any,
    nameResponse2 as any
  )
  expect(nameResponse2.result).toHaveBeenCalledWith('dev2')
  expect(mockNavigateAppend).not.toHaveBeenCalled()

  attempts[1]!.resolve()
  await flush()
})

test('cancel while parked tears the run down', async () => {
  const attempts = mockLoginAttempts()

  submitProvisionUsername('alice')
  await flush()
  pauseProvision()
  await flush()

  cancelProvision()
  await flush()

  // dead run: submits are no-ops, nothing restarts, no error screen
  submitProvisionDeviceName('dev1')
  await flush()
  expect(attempts.length).toBe(1)
  expect(mockNavigateAppend).not.toHaveBeenCalledWith(expect.objectContaining({name: 'error'}), true)
})

test('a prompt arriving after pause is rejected and does not navigate', async () => {
  const attempts = mockLoginAttempts()

  submitProvisionUsername('alice')
  await flush()
  const attempt1 = attempts[0]!

  pauseProvision()
  await flush()

  mockNavigateAppend.mockClear()
  const response = {error: jest.fn(), result: jest.fn()}
  attempt1.listener.customResponseIncomingCallMap?.['keybase.1.secretUi.getPassphrase']?.(
    {pinentry: {retryLabel: '', type: T.RPCGen.PassphraseType.passPhrase}} as any,
    response as any
  )
  expect(response.error).toHaveBeenCalled()
  expect(mockNavigateAppend).not.toHaveBeenCalled()
})
