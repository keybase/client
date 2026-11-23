/// <reference types="jest" />
import * as T from '@/constants/types'
import RPCError from '@/util/rpcerror'
import {resetAllStores} from '@/util/zustand'
import {makePhoneError, useSettingsPhoneState} from '../settings-phone'

afterEach(() => {
  jest.restoreAllMocks()
  resetAllStores()
})

test('makePhoneError maps the expected RPC errors', () => {
  expect(
    makePhoneError(new RPCError('wrong code', T.RPCGen.StatusCode.scphonenumberwrongverificationcode))
  ).toBe('Incorrect code, please try again.')
  expect(makePhoneError(new RPCError('expired', T.RPCGen.StatusCode.scphonenumberverificationcodeexpired))).toBe(
    'Verification code expired, resend and try again.'
  )
})

test('resetState clears the cached phone numbers', () => {
  useSettingsPhoneState.getState().dispatch.setNumbers([
    {
      phoneNumber: '+15555550123',
      superseded: false,
      verified: false,
      visibility: T.RPCGen.IdentityVisibility.private,
    } as any,
  ])

  useSettingsPhoneState.getState().dispatch.resetState()

  expect(useSettingsPhoneState.getState().phones).toBeUndefined()
})
