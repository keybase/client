/// <reference types="jest" />
import Session from './session'
import {RPCError} from '@/util/errors'
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'

const mockDispatchWaitingAction = jest.fn()
jest.mock('./require', () => ({
  getEngine: () => ({dispatchWaitingAction: mockDispatchWaitingAction}),
}))

afterEach(() => {
  mockDispatchWaitingAction.mockReset()
})

const makeSession = (waitingKey?: string) =>
  new Session({
    customResponseIncomingCallMap: {'keybase.1.provisionUi.chooseDevice': jest.fn()} as never,
    endHandler: jest.fn(),
    invoke: jest.fn(),
    sessionID: 123,
    waitingKey,
  })

test('cancel rejects the start callback with a cancel RPCError', () => {
  const session = makeSession()
  const callback = jest.fn()
  session.start('keybase.1.login.login', undefined, callback)
  session.cancel()

  expect(callback).toHaveBeenCalledTimes(1)
  const err = callback.mock.calls[0]![0] as RPCError
  expect(err).toBeInstanceOf(RPCError)
  expect(err.code).toBe(T.RPCGen.StatusCode.sccanceled)
})

test('cancel releases the waiting count when the server owes us a response', () => {
  const session = makeSession('waiting-key')
  session.start('keybase.1.login.login', undefined, jest.fn())
  mockDispatchWaitingAction.mockReset() // drop the +1 from start

  session.cancel()
  expect(mockDispatchWaitingAction).toHaveBeenCalledWith('waiting-key', false, undefined)
})

test('cancel does not double-release waiting while a prompt is pending on the GUI', () => {
  const session = makeSession('waiting-key')
  session.start('keybase.1.login.login', undefined, jest.fn())
  // server calls us back with a prompt: waiting flips false and stays false until we respond
  session.incomingCall('keybase.1.provisionUi.chooseDevice', {}, {seqid: 5} as never)
  mockDispatchWaitingAction.mockReset()

  session.cancel()
  expect(mockDispatchWaitingAction).not.toHaveBeenCalled()
})

test('a late server response after cancel does not fire the callback twice', () => {
  const callback = jest.fn()
  const invoke = jest.fn()
  const session2 = new Session({endHandler: jest.fn(), invoke, sessionID: 7})
  session2.start('keybase.1.login.login', undefined, callback)
  session2.cancel()
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
      endHandler: jest.fn(),
      invoke,
      sessionID: 9,
      waitingKey: 'waiting-key',
    })
    session.start(method, undefined, callback)
    mockDispatchWaitingAction.mockReset() // drop the +1 from start
    const reply = invoke.mock.calls[0]![2] as (err: unknown, data: unknown) => void
    return {callback, reply, session}
  }
  const logOut = () => {
    resetAllStores()
  }

  test('its reply is refused after a logout, without touching the waiting count', () => {
    const {callback, reply} = startCall('keybase.1.user.getUserBlocks')
    logOut()

    reply(undefined, [{username: 'testuser-mac'}])

    expect(callback).toHaveBeenCalledTimes(1)
    const [err, data] = callback.mock.calls[0]! as [RPCError, unknown]
    expect(err).toBeInstanceOf(RPCError)
    expect(err.code).toBe(T.RPCGen.StatusCode.sccanceled)
    expect(data).toBeUndefined()
    expect(mockDispatchWaitingAction).not.toHaveBeenCalled()
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
    expect(mockDispatchWaitingAction).toHaveBeenCalledWith('waiting-key', false, undefined)
  })

  test('a call started after the logout is answered normally', () => {
    logOut()
    const {callback, reply} = startCall('keybase.1.user.getUserBlocks')

    reply(undefined, [])

    expect(callback).toHaveBeenCalledWith(undefined, [])
  })
})
