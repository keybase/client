/// <reference types="jest" />
import * as S from '@/constants/strings'
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'

import {useSignupState} from '../signup'

afterEach(() => {
  jest.restoreAllMocks()
  resetAllStores()
})

const flush = async () => new Promise<void>(resolve => setImmediate(resolve))

test('setUsername stages the validated signup username', () => {
  useSignupState.getState().dispatch.setUsername('alice123')

  expect(useSignupState.getState().username).toBe('alice123')
})

test('setDevicename stages the selected signup device name', () => {
  useSignupState.getState().dispatch.setDevicename('Phone 2')

  expect(useSignupState.getState().devicename).toBe('Phone 2')
})

test('requestAutoInvite marks signup as ready once the invite code request completes', async () => {
  jest.spyOn(T.RPCGen, 'signupGetInvitationCodeRpcPromise').mockResolvedValue('invite-code')

  useSignupState.getState().dispatch.requestAutoInvite('alice')
  await flush()

  const state = useSignupState.getState()
  expect(state.autoInviteState).toBe('ready')
  expect(state.inviteCode).toBe('invite-code')
  expect(state.username).toBe('alice')
})

test('email verification notifications clear the staged signup email', () => {
  useSignupState.getState().dispatch.setJustSignedUpEmail('alice@example.com')
  expect(useSignupState.getState().justSignedUpEmail).toBe('alice@example.com')

  useSignupState
    .getState()
    .dispatch.onEngineIncomingImpl({type: 'keybase.1.NotifyEmailAddress.emailAddressVerified'} as any)

  expect(useSignupState.getState().justSignedUpEmail).toBe('')
})

test('resetState clears staged signup values back to defaults', () => {
  useSignupState.setState(s => ({
    ...s,
    autoInviteState: 'ready',
    devicename: 'Phone 2',
    inviteCode: 'invite-code',
    justSignedUpEmail: 'alice@example.com',
    username: 'alice',
  }))

  useSignupState.getState().dispatch.resetState()

  const state = useSignupState.getState()
  expect(state.autoInviteState).toBe('idle')
  expect(state.devicename).toBe(S.defaultDevicename)
  expect(state.inviteCode).toBe('')
  expect(state.justSignedUpEmail).toBe('')
  expect(state.username).toBe('')
})
