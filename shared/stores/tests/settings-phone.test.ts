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

test('setNumbers keeps the first non-superseded row for a phone number', () => {
  const rows = [
    {
      phoneNumber: '+15555550123',
      superseded: false,
      verified: false,
      visibility: T.RPCGen.IdentityVisibility.private,
    },
    {
      phoneNumber: '+15555550123',
      superseded: true,
      verified: true,
      visibility: T.RPCGen.IdentityVisibility.public,
    },
  ] as any

  useSettingsPhoneState.getState().dispatch.setNumbers(rows)

  const row = useSettingsPhoneState.getState().phones?.get('+15555550123')
  expect(row?.superseded).toBe(false)
  expect(row?.verified).toBe(false)
})

test('setAddedPhone and clearAddedPhone only update the success banner state', () => {
  useSettingsPhoneState.getState().dispatch.setAddedPhone(true)
  expect(useSettingsPhoneState.getState().addedPhone).toBe(true)

  useSettingsPhoneState.getState().dispatch.clearAddedPhone()
  expect(useSettingsPhoneState.getState().addedPhone).toBe(false)
})
