/// <reference types="jest" />
import * as T from '@/constants/types'
import {invalidPasswordErrorString} from '@/constants/config'
import {RPCError} from '@/util/errors'
import {resetAllStores} from '@/util/zustand'

jest.mock('@/constants/router', () => {
  const actual = jest.requireActual('@/constants/router')
  return {
    ...actual,
    clearModals: jest.fn(),
    navigateAppend: jest.fn(),
  }
})

import {
  badDeviceChars,
  badDeviceRE,
  cleanDeviceName,
  goodDeviceRE,
  normalizeDeviceRE,
  useProvisionState,
} from '../provision'

const {clearModals: mockClearModals, navigateAppend: mockNavigateAppend} = require('@/constants/router') as {
  clearModals: jest.Mock
  navigateAppend: jest.Mock
}

const flush = async () => new Promise<void>(resolve => setImmediate(resolve))

const deferred = () => {
  let resolve = () => {}
  const promise = new Promise<void>(r => {
    resolve = r
  })
  return {promise, resolve}
}

const makeResponse = () => ({
  error: jest.fn(),
  result: jest.fn(),
})

const currentPrompt = () => {
  const {session} = useProvisionState.getState()
  return session.kind === 'idle' ? undefined : session.prompt
}

const makeRpcDevice = (name: string, deviceID: string, type: 'mobile' | 'desktop' | 'backup') =>
  ({
    deviceID,
    deviceNumberOfType: 1,
    name,
    type,
  }) as any

beforeEach(() => {
  resetAllStores()
})

afterEach(() => {
  jest.restoreAllMocks()
  mockClearModals.mockReset()
  mockNavigateAppend.mockReset()
  resetAllStores()
})

test('device name helpers sanitize punctuation and match the expected validation regexes', () => {
  expect(cleanDeviceName("Chris’s Phone")).toBe("Chris's Phone")
  expect("Chris's Phone".match(badDeviceChars)).toBeNull()
  expect(goodDeviceRE.test("Chris's Phone")).toBe(true)
  expect(badDeviceRE.test('bad-name-')).toBe(true)
  expect('Phone 2'.replace(normalizeDeviceRE, '')).toBe('Phone2')
})

test('startProvision increments the trigger and stores the username', () => {
  expect(useProvisionState.getState().startProvisionTrigger).toBe(0)

  useProvisionState.getState().dispatch.startProvision('alice')

  const state = useProvisionState.getState()
  expect(state.startProvisionTrigger).toBe(1)
  expect(state.username).toBe('alice')
})

test('restartProvisioning bails early when there is no username after canceling the current flow', () => {
  useProvisionState.setState(s => ({
    ...s,
    session: {kind: 'provisioning', requestID: 7},
  }))

  useProvisionState.getState().dispatch.restartProvisioning()

  expect(useProvisionState.getState().session).toEqual({kind: 'idle'})
  expect(useProvisionState.getState().startProvisionTrigger).toBe(0)
})

test('resetState preserves inline and final errors while clearing form state', () => {
  const finalError = new RPCError('final error', 1)
  const inlineError = new RPCError('inline error', 2)
  const deviceID = T.Devices.stringToDeviceID('device1')

  useProvisionState.setState(s => ({
    ...s,
    codePageOtherDevice: {
      deviceNumberOfType: 1,
      id: deviceID,
      name: 'old device',
      type: 'desktop',
    },
    deviceName: 'My Phone',
    devices: [{deviceNumberOfType: 1, id: deviceID, name: 'old device', type: 'desktop'}],
    finalError,
    forgotUsernameResult: 'success',
    inlineError,
    passphrase: 'hunter2',
    session: {kind: 'provisioning', requestID: 9},
    username: 'alice',
  }))

  useProvisionState.getState().dispatch.resetState()

  const state = useProvisionState.getState()
  expect(state.session).toEqual({kind: 'idle'})
  expect(state.devices).toEqual([])
  expect(state.deviceName).toBe('')
  expect(state.forgotUsernameResult).toBe('')
  expect(state.passphrase).toBe('')
  expect(state.username).toBe('')
  expect(state.finalError).toBe(finalError)
  expect(state.inlineError).toBe(inlineError)
})

test('submitUsername starts provisioning and submits a passphrase prompt through stable actions', async () => {
  const done = deferred()
  const response = makeResponse()

  jest.spyOn(T.RPCGen, 'loginLoginRpcListener').mockImplementation(async listener => {
    const getPassphrase = listener.customResponseIncomingCallMap?.['keybase.1.secretUi.getPassphrase']
    if (!getPassphrase) {
      throw new Error('getPassphrase handler missing')
    }
    getPassphrase(
      {pinentry: {retryLabel: '', type: T.RPCGen.PassphraseType.passPhrase}} as any,
      response as any
    )
    await done.promise
    return undefined as any
  })

  try {
    useProvisionState.getState().dispatch.submitUsername('alice')
    await flush()

    const state = useProvisionState.getState()
    expect(state.username).toBe('alice')
    expect(state.session.kind).toBe('provisioning')
    expect(currentPrompt()).toEqual({error: '', type: 'passphrase'})
    expect(mockNavigateAppend).toHaveBeenCalledWith('password')

    state.dispatch.submitPassphrase('hunter2')

    expect(useProvisionState.getState().passphrase).toBe('hunter2')
    expect(response.result).toHaveBeenCalledWith({passphrase: 'hunter2', storeSecret: false})
    expect(currentPrompt()).toBeUndefined()
  } finally {
    done.resolve()
    await flush()
  }
})

test('invalid password retry label is rewritten for the prompt', async () => {
  const done = deferred()

  jest.spyOn(T.RPCGen, 'loginLoginRpcListener').mockImplementation(async listener => {
    const getPassphrase = listener.customResponseIncomingCallMap?.['keybase.1.secretUi.getPassphrase']
    if (!getPassphrase) {
      throw new Error('getPassphrase handler missing')
    }
    getPassphrase(
      {
        pinentry: {
          retryLabel: invalidPasswordErrorString,
          type: T.RPCGen.PassphraseType.passPhrase,
        },
      } as any,
      makeResponse() as any
    )
    await done.promise
    return undefined as any
  })

  try {
    useProvisionState.setState(s => ({...s, username: 'alice'}))
    useProvisionState.getState().dispatch.restartProvisioning()
    await flush()

    expect(useProvisionState.getState().session).toMatchObject({
      kind: 'provisioning',
      prompt: {error: 'Incorrect password.', type: 'passphrase'},
    })
  } finally {
    done.resolve()
    await flush()
  }
})

test('stored device name is auto-submitted when the service asks for it again', async () => {
  const done = deferred()
  const response = makeResponse()

  jest.spyOn(T.RPCGen, 'loginLoginRpcListener').mockImplementation(async listener => {
    const promptNewDeviceName = listener.customResponseIncomingCallMap?.['keybase.1.provisionUi.PromptNewDeviceName']
    if (!promptNewDeviceName) {
      throw new Error('PromptNewDeviceName handler missing')
    }
    promptNewDeviceName({errorMessage: '', existingDevices: ['Old laptop']} as any, response as any)
    await done.promise
    return undefined as any
  })

  try {
    useProvisionState.setState(s => ({...s, deviceName: 'My Phone', username: 'alice'}))
    useProvisionState.getState().dispatch.restartProvisioning()
    await flush()

    expect(response.result).toHaveBeenCalledWith('My Phone')
    expect(mockNavigateAppend).not.toHaveBeenCalledWith('setPublicName')
    expect(useProvisionState.getState().session.kind).toBe('provisioning')
    expect(currentPrompt()).toBeUndefined()
  } finally {
    done.resolve()
    await flush()
  }
})

test('stored selected device is auto-submitted when it still exists', async () => {
  const done = deferred()
  const response = makeResponse()
  const selectedID = T.Devices.stringToDeviceID('device-1')

  jest.spyOn(T.RPCGen, 'loginLoginRpcListener').mockImplementation(async listener => {
    const chooseDevice = listener.customResponseIncomingCallMap?.['keybase.1.provisionUi.chooseDevice']
    if (!chooseDevice) {
      throw new Error('chooseDevice handler missing')
    }
    chooseDevice({devices: [makeRpcDevice('phone', 'device-1', 'mobile')]} as any, response as any)
    await done.promise
    return undefined as any
  })

  try {
    useProvisionState.setState(s => ({
      ...s,
      codePageOtherDevice: {
        deviceNumberOfType: 1,
        id: selectedID,
        name: 'phone',
        type: 'mobile',
      },
      username: 'alice',
    }))
    useProvisionState.getState().dispatch.restartProvisioning()
    await flush()

    expect(useProvisionState.getState().devices).toEqual([
      {deviceNumberOfType: 1, id: selectedID, name: 'phone', type: 'mobile'},
    ])
    expect(response.result).toHaveBeenCalledWith(selectedID)
    expect(mockNavigateAppend).not.toHaveBeenCalledWith('selectOtherDevice')
  } finally {
    done.resolve()
    await flush()
  }
})

test('canceling an active prompt responds with input canceled and clears the session', async () => {
  const done = deferred()
  const response = makeResponse()

  jest.spyOn(T.RPCGen, 'loginLoginRpcListener').mockImplementation(async listener => {
    const getPassphrase = listener.customResponseIncomingCallMap?.['keybase.1.secretUi.getPassphrase']
    if (!getPassphrase) {
      throw new Error('getPassphrase handler missing')
    }
    getPassphrase(
      {pinentry: {retryLabel: '', type: T.RPCGen.PassphraseType.passPhrase}} as any,
      response as any
    )
    await done.promise
    return undefined as any
  })

  try {
    useProvisionState.setState(s => ({...s, username: 'alice'}))
    useProvisionState.getState().dispatch.restartProvisioning()
    await flush()

    useProvisionState.getState().dispatch.cancel()

    expect(response.error).toHaveBeenCalledWith({
      code: T.RPCGen.StatusCode.scinputcanceled,
      desc: 'Input canceled',
    })
    expect(useProvisionState.getState().session).toEqual({kind: 'idle'})
  } finally {
    done.resolve()
    await flush()
  }
})

test('addNewDevice publishes the prompt-secret step and normalizes submitted text code', async () => {
  const done = deferred()
  const response = makeResponse()

  jest.spyOn(T.RPCGen, 'deviceDeviceAddRpcListener').mockImplementation(async listener => {
    const displayAndPromptSecret =
      listener.customResponseIncomingCallMap?.['keybase.1.provisionUi.DisplayAndPromptSecret']
    if (!displayAndPromptSecret) {
      throw new Error('DisplayAndPromptSecret handler missing')
    }
    displayAndPromptSecret({phrase: 'alpha beta gamma', previousErr: 'Try again'} as any, response as any)
    await done.promise
    return undefined as any
  })

  try {
    useProvisionState.getState().dispatch.addNewDevice('mobile')
    await flush()

    expect(useProvisionState.getState().session).toMatchObject({
      kind: 'addingDevice',
      prompt: {error: 'Try again', phrase: 'alpha beta gamma', type: 'promptSecret'},
    })
    expect(mockNavigateAppend).toHaveBeenCalledWith('codePage')

    useProvisionState.getState().dispatch.submitTextCode('alpha-beta\tgamma')

    expect(response.result).toHaveBeenCalledWith({
      phrase: 'alpha beta gamma',
      secret: null,
    })
    expect(currentPrompt()).toBeUndefined()
  } finally {
    done.resolve()
    await flush()
  }
})

test('a not-found RPC error is surfaced as an inline error', async () => {
  jest.spyOn(T.RPCGen, 'loginLoginRpcListener').mockRejectedValue(
    new RPCError('missing user', T.RPCGen.StatusCode.scnotfound)
  )

  useProvisionState.setState(s => ({...s, username: 'alice'}))
  useProvisionState.getState().dispatch.restartProvisioning()
  await flush()

  const state = useProvisionState.getState()
  expect(state.inlineError?.code).toBe(T.RPCGen.StatusCode.scnotfound)
  expect(state.finalError).toBeUndefined()
  expect(state.username).toBe('')
  expect(state.session).toEqual({kind: 'idle'})
})

test('a terminal RPC error is stored as finalError and routes to the error screen', async () => {
  jest.spyOn(T.RPCGen, 'loginLoginRpcListener').mockRejectedValue(
    new RPCError('boom', T.RPCGen.StatusCode.scapinetworkerror)
  )

  useProvisionState.setState(s => ({...s, username: 'alice'}))
  useProvisionState.getState().dispatch.restartProvisioning()
  await flush()

  const state = useProvisionState.getState()
  expect(state.finalError?.code).toBe(T.RPCGen.StatusCode.scapinetworkerror)
  expect(state.inlineError).toBeUndefined()
  expect(mockNavigateAppend).toHaveBeenCalledWith('error', true)
})

test('forgotUsername stores success for a successful email recovery', async () => {
  jest.spyOn(T.RPCGen, 'accountRecoverUsernameWithEmailRpcPromise').mockResolvedValue(undefined as any)

  useProvisionState.getState().dispatch.forgotUsername(undefined, 'alice@example.com')
  await flush()

  expect(useProvisionState.getState().forgotUsernameResult).toBe('success')
})

test('forgotUsername decodes recover-username RPC errors', async () => {
  jest.spyOn(T.RPCGen, 'accountRecoverUsernameWithEmailRpcPromise').mockRejectedValue(
    new RPCError('bad email', T.RPCGen.StatusCode.scinputerror)
  )

  useProvisionState.getState().dispatch.forgotUsername(undefined, 'not-an-email')
  await flush()

  expect(useProvisionState.getState().forgotUsernameResult).toBe(
    "That doesn't look like a valid email address. Try again?"
  )
})
