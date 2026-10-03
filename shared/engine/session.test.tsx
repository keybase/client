/// <reference types="jest" />
import Session from './session'
import {RPCError} from '@/util/errors'
import * as T from '@/constants/types'
import {startNewAccountGeneration, survivesAccountChange} from './account-generation'
import {survivesAccountChangeMethods} from '@/constants/rpc'
import logger from '@/logger'
import {testWaitingKey} from '@/test/waiting-key'
import type {WaitingKey} from '@/constants/waiting-key-type'

const mockDispatchWaitingAction = jest.fn()

afterEach(() => {
  mockDispatchWaitingAction.mockReset()
})

const waitingKey = testWaitingKey('waiting-key')

const makeSession = (key?: WaitingKey) =>
  new Session({
    customResponseIncomingCallMap: {'keybase.1.provisionUi.chooseDevice': jest.fn()} as never,
    dispatchWaiting: mockDispatchWaitingAction,
    endHandler: jest.fn(),
    invoke: jest.fn(),
    sessionID: 123,
    waitingKey: key,
  })

test('cancel rejects the start callback with a cancel RPCError', () => {
  const session = makeSession()
  const callback = jest.fn()
  session.start('keybase.1.login.login', undefined, callback)
  session.cancel('caller')

  expect(callback).toHaveBeenCalledTimes(1)
  const err = callback.mock.calls[0]![0] as RPCError
  expect(err).toBeInstanceOf(RPCError)
  expect(err.code).toBe(T.RPCGen.StatusCode.sccanceled)
  expect(err.kind).toEqual({reason: 'caller', type: 'cancelled'})
})

test('cancel releases the waiting count when the server owes us a response', () => {
  const session = makeSession(waitingKey)
  session.start('keybase.1.login.login', undefined, jest.fn())
  mockDispatchWaitingAction.mockReset() // drop the +1 from start

  session.cancel('caller')
  expect(mockDispatchWaitingAction).toHaveBeenCalledWith({error: undefined, increment: false, key: waitingKey})
})

test('cancel does not double-release waiting while a prompt is pending on the GUI', async () => {
  const session = makeSession(waitingKey)
  session.start('keybase.1.login.login', undefined, jest.fn())
  // server calls us back with a prompt: waiting flips false, once its handler's task is over, and stays
  // false until we respond
  session.incomingCall('keybase.1.provisionUi.chooseDevice', {}, {seqid: 5} as never)
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(mockDispatchWaitingAction).toHaveBeenLastCalledWith({error: undefined, increment: false, key: waitingKey})
  mockDispatchWaitingAction.mockReset()

  session.cancel('caller')
  expect(mockDispatchWaitingAction).not.toHaveBeenCalled()
})

test('a session ended before its RPC settled stops waiting, and says so in a dev build', () => {
  const dev = __DEV__
  global.__DEV__ = true
  const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})
  const session = makeSession(waitingKey)
  session.start('keybase.1.login.login', undefined, jest.fn())
  mockDispatchWaitingAction.mockReset() // drop the +1 from start

  session.end()
  expect(mockDispatchWaitingAction).toHaveBeenCalledWith({error: undefined, increment: false, key: waitingKey})
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('ended without settling'))
  warn.mockRestore()
  global.__DEV__ = dev
})

test('a call that fails with a plain Error stops waiting but records no error on its key', () => {
  const invoke = jest.fn()
  const session = new Session({
    dispatchWaiting: mockDispatchWaitingAction,
    endHandler: jest.fn(),
    invoke,
    sessionID: 8,
    waitingKey,
  })
  session.start('keybase.1.login.login', undefined, jest.fn())
  mockDispatchWaitingAction.mockReset()
  const reply = invoke.mock.calls[0]![2] as (err: unknown, data: unknown) => void
  reply(new Error('Queue overflow for keybase.1.login.login'), undefined)
  expect(mockDispatchWaitingAction).toHaveBeenCalledWith({error: undefined, increment: false, key: waitingKey})
})

test('a late server response after cancel does not fire the callback twice', () => {
  const callback = jest.fn()
  const invoke = jest.fn()
  const session2 = new Session({
    dispatchWaiting: mockDispatchWaitingAction,
    endHandler: jest.fn(),
    invoke,
    sessionID: 7,
  })
  session2.start('keybase.1.login.login', undefined, callback)
  session2.cancel('caller')
  expect(callback).toHaveBeenCalledTimes(1)

  // simulate the transport delivering a response afterwards
  const invokeCallback = invoke.mock.calls[0]![2] as (err: unknown, data: unknown) => void
  invokeCallback(undefined, {})
  expect(callback).toHaveBeenCalledTimes(1)
})

describe('a call that outlives its account', () => {
  const startCall = (method: string) => {
    const invoke = jest.fn()
    const callback = jest.fn()
    const session = new Session({
      customResponseIncomingCallMap: {'keybase.1.secretUi.getPassphrase': jest.fn()} as never,
      dispatchWaiting: mockDispatchWaitingAction,
      endHandler: jest.fn(),
      invoke,
      sessionID: 9,
      waitingKey,
    })
    session.start(method, undefined, callback)
    mockDispatchWaitingAction.mockReset() // drop the +1 from start
    const reply = invoke.mock.calls[0]![2] as (err: unknown, data: unknown) => void
    return {callback, reply, session}
  }
  const logOut = () => {
    startNewAccountGeneration()
  }

  test('its reply is refused after a logout, and still releases its waiting count', () => {
    const {callback, reply} = startCall('keybase.1.user.getUserBlocks')
    logOut()

    reply(undefined, [{username: 'testuser-mac'}])

    expect(callback).toHaveBeenCalledTimes(1)
    const [err, data] = callback.mock.calls[0]! as [RPCError, unknown]
    expect(err).toBeInstanceOf(RPCError)
    expect(err.code).toBe(T.RPCGen.StatusCode.sccanceled)
    expect(data).toBeUndefined()
    expect(mockDispatchWaitingAction).toHaveBeenCalledWith({error: undefined, increment: false, key: waitingKey})
  })

  test('a prompt the service sends on it is answered with an error, not handed to its handler', () => {
    const {session} = startCall('keybase.1.identify3.identify3')
    logOut()
    const error = jest.fn()
    const handler = (session as unknown as {_customResponseIncomingCallMap: Record<string, jest.Mock>})
      ._customResponseIncomingCallMap['keybase.1.secretUi.getPassphrase']!

    expect(session.incomingCall('keybase.1.secretUi.getPassphrase', {}, {error, seqid: 3} as never)).toBe(true)

    expect(handler).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalledWith(expect.objectContaining({code: T.RPCGen.StatusCode.sccanceled}))
    expect(mockDispatchWaitingAction).not.toHaveBeenCalled()
  })

  test('a call that changes the account on purpose still gets its reply', () => {
    const {callback, reply} = startCall('keybase.1.login.login')
    logOut()

    reply(undefined, undefined)

    expect(callback).toHaveBeenCalledWith(undefined, undefined)
    expect(mockDispatchWaitingAction).toHaveBeenCalledWith({error: undefined, increment: false, key: waitingKey})
  })

  test('the calls that outlived an account before the flag moved to enabled-calls.json still do', () => {
    const named = [
      'keybase.1.account.cancelReset',
      'keybase.1.account.enterResetPipeline',
      'keybase.1.config.appendGUILogs',
      'keybase.1.config.getBootstrapStatus',
      'keybase.1.config.guiGetValue',
      'keybase.1.config.guiSetValue',
      'keybase.1.config.helloIAm',
      'keybase.1.config.logSend',
      'keybase.1.config.waitForClient',
      'keybase.1.login.accountDelete',
      'keybase.1.login.deprovision',
      'keybase.1.login.getConfiguredAccounts',
      'keybase.1.login.login',
      'keybase.1.login.logout',
      'keybase.1.login.recoverPassphrase',
      'keybase.1.signup.signup',
    ]
    // What the old delegateUiCtl./notifyCtl. prefixes matched among the calls the GUI makes
    const prefixed = [
      'keybase.1.delegateUiCtl.registerChatUI',
      'keybase.1.delegateUiCtl.registerGregorFirehoseFiltered',
      'keybase.1.delegateUiCtl.registerHomeUI',
      'keybase.1.delegateUiCtl.registerIdentify3UI',
      'keybase.1.delegateUiCtl.registerLogUI',
      'keybase.1.delegateUiCtl.registerRekeyUI',
      'keybase.1.delegateUiCtl.registerSecretUI',
      'keybase.1.notifyCtl.setNotifications',
    ]
    expect([...survivesAccountChangeMethods].sort()).toEqual([...named, ...prefixed].sort())
  })

  test('registering with the service outlives an account', () => {
    expect(survivesAccountChange('keybase.1.delegateUiCtl.registerChatUI')).toBe(true)
    expect(survivesAccountChange('keybase.1.notifyCtl.setNotifications')).toBe(true)
    expect(survivesAccountChange('keybase.1.user.getUserBlocks')).toBe(false)
  })

  test('a call started after the logout is answered normally', () => {
    logOut()
    const {callback, reply} = startCall('keybase.1.user.getUserBlocks')

    reply(undefined, [])

    expect(callback).toHaveBeenCalledWith(undefined, [])
  })
})
