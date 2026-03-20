import * as T from '@/constants/types'
import RPCError from '@/util/rpcerror'
import {resetAllStores} from '@/util/zustand'
import {makePhoneError, useSettingsPhoneState} from '../settings-phone'

afterEach(() => {
  jest.restoreAllMocks()
  resetAllStores()
})

const flush = async () => new Promise<void>(resolve => setImmediate(resolve))

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

test('successful addPhoneNumber updates pending verification and can be cleared', async () => {
  const addPhone = jest
    .spyOn(T.RPCGen, 'phoneNumbersAddPhoneNumberRpcPromise')
    .mockResolvedValue(undefined as any)

  useSettingsPhoneState.getState().dispatch.addPhoneNumber('+15555550124', true)
  await flush()

  expect(addPhone).toHaveBeenCalledWith(
    {
      phoneNumber: '+15555550124',
      visibility: T.RPCGen.IdentityVisibility.public,
    },
    expect.any(String)
  )
  expect(useSettingsPhoneState.getState().pendingVerification).toBe('+15555550124')
  expect(useSettingsPhoneState.getState().error).toBe('')

  useSettingsPhoneState.getState().dispatch.clearPhoneNumberAdd()

  expect(useSettingsPhoneState.getState().pendingVerification).toBe('')
  expect(useSettingsPhoneState.getState().verificationState).toBeUndefined()
})
