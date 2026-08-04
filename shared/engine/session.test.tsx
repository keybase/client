/// <reference types="jest" />
import Session from './session'
import {RPCError} from '@/util/errors'
import * as T from '@/constants/types'

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
  const session = makeSession()
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
  void session
})
