/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {RPCError} from '@/util/errors'
import {getEngine} from '@/engine/require'

import {
  cancelProvision,
  pauseProvision,
  startAddNewDevice,
  submitProvisionDeviceName,
  submitProvisionDeviceSelect,
  submitProvisionTextCode,
  submitProvisionUsername,
  startProvision,
} from './flow'

import {installFakeNavigator, makeRootState, restoreNavigator, type FakeNavigator} from '@/test/fake-navigator'
import {installListenerEngine, uninstallListenerEngine} from '@/test/fake-listener-engine'

let nav: FakeNavigator

// Provisioning runs from a modal, so the fake starts with one open: clearModals only has
// something to dispatch when a modal is actually on screen. This one is never a
// navigation target below, so a replace onto another screen stays a replace.
const openModal = 'deviceAdd'

beforeEach(() => {
  nav = installFakeNavigator({
    modalRouteNames: [openModal],
    rootState: makeRootState({above: [{name: openModal}]}),
  })
})

afterEach(() => {
  restoreNavigator()
  cancelProvision()
  jest.restoreAllMocks()
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
  expect(nav.navigations()).toContainEqual({
    name: 'username',
    params: {fromReset: true, username: 'alice'},
    replace: false,
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

  expect(nav.navigations()).toContainEqual({
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
    replace: false,
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
  expect(nav.navigations()).toContainEqual({
    name: 'setPublicName',
    params: {devices: [], error: undefined},
    replace: false,
  })
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
  expect(nav.navigations()).toContainEqual({
    name: 'password',
    params: {error: undefined, username: 'alice'},
    replace: false,
  })

  // the user goes back and submits a different device name: the pending password
  // prompt is cancelled and the RPC restarts
  submitProvisionDeviceName('dev2')
  expect(passphraseResponse.error).toHaveBeenCalled()
  await flush()
  expect(attempts.length).toBe(2)
  const attempt2 = attempts[1]!

  // the device name prompt in the new attempt is auto-submitted with the new answer
  nav.clearActions()
  const nameResponse2 = {error: jest.fn(), result: jest.fn()}
  attempt2.listener.customResponseIncomingCallMap?.['keybase.1.provisionUi.PromptNewDeviceName']?.(
    {errorMessage: ''} as any,
    nameResponse2 as any
  )
  expect(nameResponse2.result).toHaveBeenCalledWith('dev2')
  expect(nav.actions).toEqual([])

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
  expect(nav.navigations()).toContainEqual(expect.objectContaining({name: 'codePage', replace: false}))

  // the user cancels, then tries again: the dead run must not clear modals or eat the new run's UI
  startAddNewDevice('mobile')
  expect(response1.error).toHaveBeenCalled()
  await flush()
  expect(nav.modalsCleared()).toBe(false)
  expect(attempts.length).toBe(2)
  const attempt2 = attempts[1]!

  nav.clearActions()
  const response2 = {error: jest.fn(), result: jest.fn()}
  attempt2.listener.customResponseIncomingCallMap?.['keybase.1.provisionUi.DisplayAndPromptSecret']?.(
    {phrase: 'four five six', previousErr: ''} as any,
    response2 as any
  )
  expect(nav.navigations()).toContainEqual(expect.objectContaining({name: 'codePage', replace: false}))
  expect(response2.error).not.toHaveBeenCalled()

  attempt2.resolve()
  await flush()
  // the successful run still clears modals when it finishes
  expect(nav.modalsCleared()).toBe(true)
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
  expect(nav.navigations()).not.toContainEqual(expect.objectContaining({name: 'codePage', replace: false}))

  finishListener(new RPCError('Input canceled', T.RPCGen.StatusCode.scinputcanceled))
  await flush()
  expect(nav.modalsCleared()).toBe(false)
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
  expect(nav.navigations()).not.toContainEqual(expect.objectContaining({name: 'error', replace: true}))
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
  nav.clearActions()
  const nameResponse2 = {error: jest.fn(), result: jest.fn()}
  attempts[1]!.listener.customResponseIncomingCallMap?.['keybase.1.provisionUi.PromptNewDeviceName']?.(
    {errorMessage: ''} as any,
    nameResponse2 as any
  )
  expect(nameResponse2.result).toHaveBeenCalledWith('dev2')
  expect(nav.actions).toEqual([])

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
  expect(nav.navigations()).not.toContainEqual(expect.objectContaining({name: 'error', replace: true}))
})

test('a prompt arriving after pause is rejected and does not navigate', async () => {
  const attempts = mockLoginAttempts()

  submitProvisionUsername('alice')
  await flush()
  const attempt1 = attempts[0]!

  pauseProvision()
  await flush()

  nav.clearActions()
  const response = {error: jest.fn(), result: jest.fn()}
  attempt1.listener.customResponseIncomingCallMap?.['keybase.1.secretUi.getPassphrase']?.(
    {pinentry: {retryLabel: '', type: T.RPCGen.PassphraseType.passPhrase}} as any,
    response as any
  )
  expect(response.error).toHaveBeenCalled()
  expect(nav.actions).toEqual([])
})

test('pause with a pending prompt still resumes when the same step is resubmitted', async () => {
  const attempts = mockLoginAttempts()

  submitProvisionUsername('alice')
  await flush()
  expect(attempts.length).toBe(1)
  const attempt1 = attempts[0]!

  // the service prompts for a device name and the user is looking at it (unanswered)
  // when they back out mid-prompt
  const nameResponse = {
    error: jest.fn(() => {
      attempt1.reject(new RPCError('Input canceled', T.RPCGen.StatusCode.scinputcanceled))
    }),
    result: jest.fn(),
  }
  attempt1.listener.customResponseIncomingCallMap?.['keybase.1.provisionUi.PromptNewDeviceName']?.(
    {errorMessage: ''} as any,
    nameResponse as any
  )

  pauseProvision()
  expect(nameResponse.error).toHaveBeenCalled()
  await flush()
  expect(attempts.length).toBe(1)

  // user resubmits the same step that was pending at pause time
  submitProvisionDeviceName('dev1')
  await flush()
  expect(attempts.length).toBe(2)
  const attempt2 = attempts[1]!

  // the new attempt auto-submits the replayed answer without navigating
  nav.clearActions()
  const nameResponse2 = {error: jest.fn(), result: jest.fn()}
  attempt2.listener.customResponseIncomingCallMap?.['keybase.1.provisionUi.PromptNewDeviceName']?.(
    {errorMessage: ''} as any,
    nameResponse2 as any
  )
  expect(nameResponse2.result).toHaveBeenCalledWith('dev1')

  attempt2.resolve()
  await flush()
})

describe('through the engine listener', () => {
  afterEach(() => uninstallListenerEngine())

  const loginMethod = 'keybase.1.login.login'
  const secretMethod = 'keybase.1.provisionUi.DisplayAndPromptSecret'

  const failLogin = async (code: T.RPCGen.StatusCode, desc: string) => {
    const engine = installListenerEngine()
    submitProvisionUsername('testuser')
    await flush()
    engine.fail('keybase.1.login.login', code, desc)
    await flush()
  }

  test('an unknown username replaces the username screen with its inline error', async () => {
    await failLogin(T.RPCGen.StatusCode.scnotfound, 'not found')

    expect(nav.navigations()).toContainEqual({
      name: 'username',
      params: {inlineErrorCode: T.RPCGen.StatusCode.scnotfound, username: 'testuser'},
      replace: true,
    })
    expect(nav.modalsCleared()).toBe(false)
  })

  test('any other service error clears the modals and shows the error screen', async () => {
    await failLogin(T.RPCGen.StatusCode.scgeneric, 'it broke')

    expect(nav.modalsCleared()).toBe(true)
    const errors = nav.navigations().filter(n => n.name === 'error')
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({
      params: {error: {code: T.RPCGen.StatusCode.scgeneric, desc: 'it broke'}, username: 'testuser'},
      replace: true,
    })
  })

  // Only a cancel the run caused is quiet; the error screen reads scinputcanceled as "Login cancelled."
  test('a service-side input cancel shows the error screen', async () => {
    await failLogin(T.RPCGen.StatusCode.scinputcanceled, 'canceled by the service')

    expect(nav.modalsCleared()).toBe(true)
    expect(nav.navigations().filter(n => n.name === 'error')).toEqual([
      {
        name: 'error',
        params: {error: expect.objectContaining({code: T.RPCGen.StatusCode.scinputcanceled}), username: 'testuser'},
        replace: true,
      },
    ])
  })

  // The engine cancels every session when the link drops, with no account change
  test('a lost link shows the error screen', async () => {
    installListenerEngine()
    submitProvisionUsername('testuser')
    await flush()
    getEngine().cancelOutstandingSessions()
    await flush()

    expect(nav.modalsCleared()).toBe(true)
    expect(nav.navigations().filter(n => n.name === 'error')).toEqual([
      {
        name: 'error',
        params: {error: expect.objectContaining({code: T.RPCGen.StatusCode.sccanceled}), username: 'testuser'},
        replace: true,
      },
    ])
  })

  test('our own cancel shows nothing', async () => {
    const engine = installListenerEngine()
    submitProvisionUsername('testuser')
    await flush()
    cancelProvision()
    await flush()

    expect(() => engine.pending(loginMethod)).toThrow()
    expect(nav.navigations().filter(n => n.name === 'error' || n.name === 'username')).toEqual([])
    expect(nav.modalsCleared()).toBe(false)
  })

  // The switch cancels the login's session: a failure the run caused
  const switchMidLogin = async (endSwitch: 'before the run reads the failure' | 'after the run is over') => {
    const {setUserSwitching} = useConfigState.getState().dispatch
    const engine = installListenerEngine()
    submitProvisionUsername('testuser')
    await flush()
    setUserSwitching(true, 'testuser2')
    if (endSwitch === 'before the run reads the failure') {
      setUserSwitching(false)
    }
    await flush()
    setUserSwitching(false)

    // the session was cancelled, and the run is over: a submit starts nothing
    expect(() => engine.pending(loginMethod)).toThrow()
    submitProvisionDeviceName('dev1')
    await flush()
    expect(engine.calls.filter(c => c.method === loginMethod)).toHaveLength(1)
    expect(nav.navigations().filter(n => n.name === 'error' || n.name === 'username')).toEqual([])
    expect(nav.modalsCleared()).toBe(false)
  }

  // Read while the switch runs: logged out, the switch starts no new account generation
  test('an account switch from logged out during a login shows nothing', async () => {
    await switchMidLogin('after the run is over')
  })

  // Read from the account generation, which a switch from a logged-in account moves on
  test('an account switch from logged in shows nothing even once the switch has ended', async () => {
    useConfigState.getState().dispatch.setLoggedIn(true)
    await switchMidLogin('before the run reads the failure')
  })

  test('an error our own prompt cancel caused shows nothing', async () => {
    await failLogin(T.RPCGen.StatusCode.scgeneric, 'Input canceled')

    expect(nav.navigations().filter(n => n.name === 'error' || n.name === 'username')).toEqual([])
    expect(nav.modalsCleared()).toBe(false)
  })

  // Go cancels the secret prompt still waiting here once the other device finished, and the login
  // succeeds; this engine ends the session on that cancel, so the login rejects first
  test('a key exchange the other device finished shows nothing, and Go\'s late reply is harmless', async () => {
    const engine = installListenerEngine()
    submitProvisionUsername('testuser')
    await flush()
    const call = engine.pending(loginMethod)
    const response = {error: jest.fn(), result: jest.fn()}
    call.incomingCallMap[secretMethod]?.({phrase: 'one two three', previousErr: ''}, response)
    // the listener hands the prompt to its handler on a timer
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(nav.navigations()).toContainEqual(expect.objectContaining({name: 'codePage', replace: false}))
    nav.clearActions()

    engine.fail(loginMethod, T.RPCGen.StatusCode.sccanceled, 'Received RPC cancel for session')
    await flush()
    expect(nav.navigations()).toEqual([])
    expect(nav.modalsCleared()).toBe(false)

    // the login's success reply reaches a settled call
    call.callback(undefined, undefined)
    await flush()
    expect(nav.navigations()).toEqual([])
    expect(response.result).not.toHaveBeenCalled()
    expect(response.error).not.toHaveBeenCalled()
  })

  test('the same cancel after the user answered the secret prompt shows the error screen', async () => {
    const engine = installListenerEngine()
    submitProvisionUsername('testuser')
    await flush()
    const response = {error: jest.fn(), result: jest.fn()}
    engine.pending(loginMethod).incomingCallMap[secretMethod]?.({phrase: 'one two three', previousErr: ''}, response)
    await new Promise(resolve => setTimeout(resolve, 0))
    submitProvisionTextCode('one two three')
    expect(response.result).toHaveBeenCalled()

    engine.fail(loginMethod, T.RPCGen.StatusCode.sccanceled, 'Received RPC cancel for session')
    await flush()
    expect(nav.modalsCleared()).toBe(true)
    expect(nav.navigations().filter(n => n.name === 'error')).toHaveLength(1)
  })

  test('the same cancel with no secret prompt waiting shows the error screen', async () => {
    await failLogin(T.RPCGen.StatusCode.sccanceled, 'Received RPC cancel for session')
    expect(nav.modalsCleared()).toBe(true)
    expect(nav.navigations().filter(n => n.name === 'error')).toHaveLength(1)
  })

  test('add-device: a lost link closes the modals', async () => {
    installListenerEngine()
    startAddNewDevice('mobile')
    await flush()
    getEngine().cancelOutstandingSessions()
    await flush()
    expect(nav.modalsCleared()).toBe(true)
  })

  test('add-device: our own cancel leaves the modals', async () => {
    installListenerEngine()
    startAddNewDevice('mobile')
    await flush()
    cancelProvision()
    await flush()
    expect(nav.modalsCleared()).toBe(false)
  })
})
