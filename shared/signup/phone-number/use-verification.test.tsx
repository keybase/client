/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import RPCError from '@/util/rpcerror'
import {act, cleanup, renderHook} from '@testing-library/react'
import {resetAllStores} from '@/util/zustand'
import {useAddPhoneNumber, usePhoneVerification} from './use-verification'

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

const flush = async () => {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

const phoneNumber = '+15555550123'

describe('adding a phone number', () => {
  test('a searchable number is submitted as publicly visible', async () => {
    const add = jest.spyOn(T.RPCGen, 'phoneNumbersAddPhoneNumberRpcPromise').mockResolvedValue(undefined)
    const onSuccess = jest.fn()

    const {result} = renderHook(() => useAddPhoneNumber())
    act(() => {
      result.current.submitPhoneNumber(phoneNumber, true, onSuccess)
    })
    await flush()

    expect(add).toHaveBeenCalledWith(
      {phoneNumber, visibility: T.RPCGen.IdentityVisibility.public},
      expect.any(String)
    )
    expect(onSuccess).toHaveBeenCalledWith(phoneNumber)
    expect(result.current.error).toBe('')
  })

  test('a non-searchable number is submitted as private', async () => {
    const add = jest.spyOn(T.RPCGen, 'phoneNumbersAddPhoneNumberRpcPromise').mockResolvedValue(undefined)

    const {result} = renderHook(() => useAddPhoneNumber())
    act(() => {
      result.current.submitPhoneNumber(phoneNumber, false, jest.fn())
    })
    await flush()

    expect(add).toHaveBeenCalledWith(
      {phoneNumber, visibility: T.RPCGen.IdentityVisibility.private},
      expect.any(String)
    )
  })

  test('a rejected number surfaces a readable error and skips the success callback', async () => {
    jest
      .spyOn(T.RPCGen, 'phoneNumbersAddPhoneNumberRpcPromise')
      .mockRejectedValue(new RPCError('already', T.RPCGen.StatusCode.scphonenumberalreadyverified))
    const onSuccess = jest.fn()

    const {result} = renderHook(() => useAddPhoneNumber())
    act(() => {
      result.current.submitPhoneNumber(phoneNumber, true, onSuccess)
    })
    await flush()

    expect(result.current.error).toBe('This phone number is already verified.')
    expect(onSuccess).not.toHaveBeenCalled()
  })

  test('clearing the error resets it', async () => {
    jest
      .spyOn(T.RPCGen, 'phoneNumbersAddPhoneNumberRpcPromise')
      .mockRejectedValue(new RPCError('rate limited', T.RPCGen.StatusCode.scratelimit))

    const {result} = renderHook(() => useAddPhoneNumber())
    act(() => {
      result.current.submitPhoneNumber(phoneNumber, true, jest.fn())
    })
    await flush()
    expect(result.current.error).not.toBe('')

    act(() => {
      result.current.clearError()
    })

    expect(result.current.error).toBe('')
  })
})

describe('verifying a phone number', () => {
  test('the initial resend fires exactly once across re-renders', async () => {
    const resend = jest
      .spyOn(T.RPCGen, 'phoneNumbersResendVerificationForPhoneNumberRpcPromise')
      .mockResolvedValue(undefined)

    const {rerender} = renderHook(() => usePhoneVerification({initialResend: true, phoneNumber}))
    await flush()
    rerender()
    await flush()

    expect(resend).toHaveBeenCalledTimes(1)
    expect(resend).toHaveBeenCalledWith({phoneNumber}, expect.any(String))
  })

  test('no resend happens when the screen was not asked to resend', async () => {
    const resend = jest
      .spyOn(T.RPCGen, 'phoneNumbersResendVerificationForPhoneNumberRpcPromise')
      .mockResolvedValue(undefined)

    renderHook(() => usePhoneVerification({phoneNumber}))
    await flush()

    expect(resend).not.toHaveBeenCalled()
  })

  test('a correct code reports success', async () => {
    const verify = jest.spyOn(T.RPCGen, 'phoneNumbersVerifyPhoneNumberRpcPromise').mockResolvedValue(undefined)
    const onSuccess = jest.fn()

    const {result} = renderHook(() => usePhoneVerification({onSuccess, phoneNumber}))
    act(() => {
      result.current.verifyPhoneNumber(phoneNumber, '123456')
    })
    await flush()

    expect(verify).toHaveBeenCalledWith({code: '123456', phoneNumber}, expect.any(String))
    expect(onSuccess).toHaveBeenCalled()
    expect(result.current.error).toBe('')
  })

  test('a wrong code shows the retry message and does not report success', async () => {
    jest
      .spyOn(T.RPCGen, 'phoneNumbersVerifyPhoneNumberRpcPromise')
      .mockRejectedValue(new RPCError('nope', T.RPCGen.StatusCode.scphonenumberwrongverificationcode))
    const onSuccess = jest.fn()

    const {result} = renderHook(() => usePhoneVerification({onSuccess, phoneNumber}))
    act(() => {
      result.current.verifyPhoneNumber(phoneNumber, '000000')
    })
    await flush()

    expect(result.current.error).toBe('Incorrect code, please try again.')
    expect(onSuccess).not.toHaveBeenCalled()
  })

  test('resending clears a previous error', async () => {
    jest
      .spyOn(T.RPCGen, 'phoneNumbersVerifyPhoneNumberRpcPromise')
      .mockRejectedValue(new RPCError('expired', T.RPCGen.StatusCode.scphonenumberverificationcodeexpired))
    jest
      .spyOn(T.RPCGen, 'phoneNumbersResendVerificationForPhoneNumberRpcPromise')
      .mockResolvedValue(undefined)

    const {result} = renderHook(() => usePhoneVerification({phoneNumber}))
    act(() => {
      result.current.verifyPhoneNumber(phoneNumber, '000000')
    })
    await flush()
    expect(result.current.error).toBe('Verification code expired, resend and try again.')

    act(() => {
      result.current.resendVerificationForPhone(phoneNumber)
    })
    await flush()

    expect(result.current.error).toBe('')
  })
})
