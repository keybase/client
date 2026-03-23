/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'

jest.mock('@/constants/router', () => {
  const actual = jest.requireActual('@/constants/router')
  return {
    ...actual,
    navigateAppend: jest.fn(),
    navigateUp: jest.fn(),
  }
})

import {useSignupState} from '../signup'

const {navigateAppend: mockNavigateAppend, navigateUp: mockNavigateUp} = require('@/constants/router') as {
  navigateAppend: jest.Mock
  navigateUp: jest.Mock
}

afterEach(() => {
  jest.restoreAllMocks()
  mockNavigateAppend.mockReset()
  mockNavigateUp.mockReset()
  resetAllStores()
})

const flush = async () => new Promise<void>(resolve => setImmediate(resolve))

test('invalid usernames are rejected locally without calling the RPC', () => {
  const checkUsername = jest.spyOn(T.RPCGen, 'signupCheckUsernameAvailableRpcPromise')

  useSignupState.getState().dispatch.checkUsername('bad username')

  expect(useSignupState.getState().username).toBe('bad username')
  expect(useSignupState.getState().usernameError).not.toBe('')
  expect(checkUsername).not.toHaveBeenCalled()
})

test('checkUsername accepts a valid username and navigates to device setup', async () => {
  jest.spyOn(T.RPCGen, 'signupCheckUsernameAvailableRpcPromise').mockResolvedValue(undefined as any)

  useSignupState.getState().dispatch.checkUsername('alice123')
  await flush()

  expect(useSignupState.getState().username).toBe('alice123')
  expect(useSignupState.getState().usernameError).toBe('')
  expect(useSignupState.getState().usernameTaken).toBe('')
  expect(mockNavigateAppend).toHaveBeenCalledWith('signupEnterDevicename')
})

test('email verification notifications clear the staged signup email', () => {
  useSignupState.getState().dispatch.setJustSignedUpEmail('alice@example.com')
  expect(useSignupState.getState().justSignedUpEmail).toBe('alice@example.com')

  useSignupState
    .getState()
    .dispatch.onEngineIncomingImpl({type: 'keybase.1.NotifyEmailAddress.emailAddressVerified'} as any)

  expect(useSignupState.getState().justSignedUpEmail).toBe('')
})
