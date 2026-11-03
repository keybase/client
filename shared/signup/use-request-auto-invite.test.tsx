/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {act, cleanup, renderHook, waitFor} from '@testing-library/react'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {useWaitingState} from '@/stores/waiting'
import {waitingKeySignup} from '@/constants/strings'
import {navigationWrapper} from '@/test/navigation'
import useRequestAutoInvite from './use-request-auto-invite'

// The hook as the login screen runs it, on the logged-out stack.
const renderOnLogin = () => {
  const nav = navigationWrapper({route: 'login'})
  const {result} = renderHook(() => useRequestAutoInvite(), {wrapper: nav.wrapper})
  act(() => result.current('testuser'))
  return nav
}

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

test('fetches an invite code and moves on to the username screen', async () => {
  const logout = jest.spyOn(T.RPCGen, 'loginLogoutRpcPromise').mockResolvedValue(undefined as any)
  const getCode = jest
    .spyOn(T.RPCGen, 'signupGetInvitationCodeRpcPromise')
    .mockResolvedValue('invite-code' as any)

  const nav = renderOnLogin()

  await waitFor(() => expect(nav.visibleScreen()?.name).toBe('signupEnterUsername'))
  expect(nav.visibleScreen()?.params).toEqual({inviteCode: 'invite-code', username: 'testuser'})
  expect(logout).not.toHaveBeenCalled()
  expect(getCode).toHaveBeenCalledWith(undefined, waitingKeySignup)
})

test('logs out first when an account is already signed in', async () => {
  const logout = jest.spyOn(T.RPCGen, 'loginLogoutRpcPromise').mockResolvedValue(undefined as any)
  jest.spyOn(T.RPCGen, 'signupGetInvitationCodeRpcPromise').mockResolvedValue('invite-code' as any)
  useConfigState.getState().dispatch.setLoggedIn(true)

  const nav = renderOnLogin()

  await waitFor(() => expect(nav.visibleScreen()?.name).toBe('signupEnterUsername'))
  expect(nav.visibleScreen()?.params).toEqual({inviteCode: 'invite-code', username: 'testuser'})
  expect(logout).toHaveBeenCalledWith({force: false, keepSecrets: true})
})

test('a failed invite code fetch still continues with an empty code', async () => {
  jest.spyOn(T.RPCGen, 'signupGetInvitationCodeRpcPromise').mockRejectedValue(new Error('offline'))

  const nav = renderOnLogin()

  await waitFor(() => expect(nav.visibleScreen()?.name).toBe('signupEnterUsername'))
  expect(nav.visibleScreen()?.params).toEqual({inviteCode: '', username: 'testuser'})
})

test('a request already in flight is ignored', async () => {
  const getCode = jest
    .spyOn(T.RPCGen, 'signupGetInvitationCodeRpcPromise')
    .mockResolvedValue('invite-code' as any)
  useWaitingState.getState().dispatch.increment(waitingKeySignup)

  const nav = renderOnLogin()

  // nothing to wait for; give any queued work a full macrotask to run anyway
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(getCode).not.toHaveBeenCalled()
  expect(nav.actions).toEqual([])
  expect(nav.visibleScreen()?.name).toBe('login')
})
