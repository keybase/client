/// <reference types="jest" />
import * as S from '@/constants/strings'
import {resetAllStores} from '@/util/zustand'

import {useSignupState} from '../signup'

afterEach(() => {
  jest.restoreAllMocks()
  resetAllStores()
})

test('setDevicename stages the selected signup device name', () => {
  useSignupState.getState().dispatch.setDevicename('Phone 2')

  expect(useSignupState.getState().devicename).toBe('Phone 2')
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
    devicename: 'Phone 2',
    justSignedUpEmail: 'alice@example.com',
  }))

  useSignupState.getState().dispatch.resetState()

  const state = useSignupState.getState()
  expect(state.devicename).toBe(S.defaultDevicename)
  expect(state.justSignedUpEmail).toBe('')
})
