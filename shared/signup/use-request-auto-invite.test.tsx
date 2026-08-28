/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {cleanup, renderHook, waitFor} from '@testing-library/react'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {useWaitingState} from '@/stores/waiting'
import {waitingKeySignup} from '@/constants/strings'

jest.mock('@/constants/router', () => {
  const actual = jest.requireActual('@/constants/router')
  return {...actual, navigateAppend: jest.fn()}
})

import useRequestAutoInvite from './use-request-auto-invite'

const {navigateAppend: mockNavigateAppend} = require('@/constants/router') as {navigateAppend: jest.Mock}

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  mockNavigateAppend.mockReset()
  resetAllStores()
})

test('fetches an invite code and moves on to the username screen', async () => {
  const logout = jest.spyOn(T.RPCGen, 'loginLogoutRpcPromise').mockResolvedValue(undefined as any)
  const getCode = jest
    .spyOn(T.RPCGen, 'signupGetInvitationCodeRpcPromise')
    .mockResolvedValue('invite-code' as any)

  const {result} = renderHook(() => useRequestAutoInvite())
  result.current('testuser')

  await waitFor(() =>
    expect(mockNavigateAppend).toHaveBeenCalledWith({
      name: 'signupEnterUsername',
      params: {inviteCode: 'invite-code', username: 'testuser'},
    })
  )
  expect(logout).not.toHaveBeenCalled()
  expect(getCode).toHaveBeenCalledWith(undefined, waitingKeySignup)
})

test('logs out first when an account is already signed in', async () => {
  const logout = jest.spyOn(T.RPCGen, 'loginLogoutRpcPromise').mockResolvedValue(undefined as any)
  jest.spyOn(T.RPCGen, 'signupGetInvitationCodeRpcPromise').mockResolvedValue('invite-code' as any)
  useConfigState.getState().dispatch.setLoggedIn(true)

  const {result} = renderHook(() => useRequestAutoInvite())
  result.current('testuser')

  await waitFor(() =>
    expect(mockNavigateAppend).toHaveBeenCalledWith({
      name: 'signupEnterUsername',
      params: {inviteCode: 'invite-code', username: 'testuser'},
    })
  )
  expect(logout).toHaveBeenCalledWith({force: false, keepSecrets: true})
})

test('a failed invite code fetch still continues with an empty code', async () => {
  jest.spyOn(T.RPCGen, 'signupGetInvitationCodeRpcPromise').mockRejectedValue(new Error('offline'))

  const {result} = renderHook(() => useRequestAutoInvite())
  result.current('testuser')

  await waitFor(() =>
    expect(mockNavigateAppend).toHaveBeenCalledWith({
      name: 'signupEnterUsername',
      params: {inviteCode: '', username: 'testuser'},
    })
  )
})

test('a request already in flight is ignored', async () => {
  const getCode = jest
    .spyOn(T.RPCGen, 'signupGetInvitationCodeRpcPromise')
    .mockResolvedValue('invite-code' as any)
  useWaitingState.getState().dispatch.increment(waitingKeySignup)

  const {result} = renderHook(() => useRequestAutoInvite())
  result.current('testuser')

  // nothing to wait for; give any queued work a full macrotask to run anyway
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(getCode).not.toHaveBeenCalled()
  expect(mockNavigateAppend).not.toHaveBeenCalled()
})
