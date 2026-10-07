/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {ensureError, RPCError} from '@/util/errors'
import {withChatSessionRetry} from './session-rpc'

beforeEach(() => {
  useConfigState.setState({loggedIn: true, userSwitching: false})
  useCurrentUserState.setState({username: 'testuser'})
})

afterEach(() => {
  resetAllStores()
})

const loginRequired = () => new RPCError('chat session not ready', T.RPCGen.StatusCode.scloginrequired)

test('returns the first success', async () => {
  const run = jest.fn().mockResolvedValue('ok')
  await expect(withChatSessionRetry(run)).resolves.toBe('ok')
  expect(run).toHaveBeenCalledTimes(1)
})

test('gives up when the username is empty', async () => {
  useCurrentUserState.setState({username: ''})
  const run = jest.fn().mockResolvedValue('ok')
  await expect(withChatSessionRetry(run)).resolves.toBeUndefined()
  expect(run).not.toHaveBeenCalled()
})

test('gives up when the chat session is not ready', async () => {
  useConfigState.setState({loggedIn: true, userSwitching: true})
  const run = jest.fn().mockResolvedValue('ok')
  await expect(withChatSessionRetry(run)).resolves.toBeUndefined()
  expect(run).not.toHaveBeenCalled()
})

// The engine has already tried it again
test('a login-required failure is nothing loaded, and is not tried again here', async () => {
  const run = jest.fn().mockRejectedValue(loginRequired())
  await expect(withChatSessionRetry(run)).resolves.toBeUndefined()
  expect(run).toHaveBeenCalledTimes(1)
})

test("a login-required failure from a listener's call is nothing loaded too", async () => {
  const run = jest.fn().mockRejectedValue(ensureError(loginRequired()))
  await expect(withChatSessionRetry(run)).resolves.toBeUndefined()
})

test('other errors reach the caller', async () => {
  const run = jest.fn().mockRejectedValue(new RPCError('nope', T.RPCGen.StatusCode.scgeneric))
  await expect(withChatSessionRetry(run)).rejects.toMatchObject({code: T.RPCGen.StatusCode.scgeneric})
  expect(run).toHaveBeenCalledTimes(1)
})
