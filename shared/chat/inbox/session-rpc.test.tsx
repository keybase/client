/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {RPCError} from '@/util/errors'
import {withChatSessionRetry} from './session-rpc'

beforeEach(() => {
  useConfigState.setState({loggedIn: true, userSwitching: false})
  useCurrentUserState.setState({username: 'testuser'})
})

afterEach(() => {
  resetAllStores()
  jest.useRealTimers()
})

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

test('retries login-required while still logged in', async () => {
  jest.useFakeTimers()
  const run = jest
    .fn()
    .mockRejectedValueOnce(new RPCError('chat session not ready', T.RPCGen.StatusCode.scloginrequired))
    .mockResolvedValueOnce('ok')

  const pending = withChatSessionRetry(run)
  await jest.advanceTimersByTimeAsync(250)
  await expect(pending).resolves.toBe('ok')
  expect(run).toHaveBeenCalledTimes(2)
})

test('does not retry other errors', async () => {
  const run = jest.fn().mockRejectedValue(new RPCError('nope', T.RPCGen.StatusCode.scgeneric))
  await expect(withChatSessionRetry(run)).rejects.toMatchObject({code: T.RPCGen.StatusCode.scgeneric})
  expect(run).toHaveBeenCalledTimes(1)
})

test('gives up when the chat session is no longer ready', async () => {
  jest.useFakeTimers()
  const run = jest
    .fn()
    .mockRejectedValue(new RPCError('chat session not ready', T.RPCGen.StatusCode.scloginrequired))

  const pending = withChatSessionRetry(run)
  await Promise.resolve()
  useConfigState.setState({loggedIn: true, userSwitching: true})
  await jest.advanceTimersByTimeAsync(250)
  await expect(pending).resolves.toBeUndefined()
  expect(run).toHaveBeenCalledTimes(1)
})

test('gives up when the username changes during retry', async () => {
  jest.useFakeTimers()
  const run = jest
    .fn()
    .mockRejectedValue(new RPCError('chat session not ready', T.RPCGen.StatusCode.scloginrequired))

  const pending = withChatSessionRetry(run)
  await Promise.resolve()
  useCurrentUserState.setState({username: 'otheruser'})
  await jest.advanceTimersByTimeAsync(250)
  await expect(pending).resolves.toBeUndefined()
  expect(run).toHaveBeenCalledTimes(1)
})
