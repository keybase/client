/** @jest-environment jsdom */
/// <reference types="jest" />
import {act, cleanup, renderHook} from '@testing-library/react'
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {fakeError, installFakeEngine} from '@/test/fake-engine'
import {flush} from '@/test/flush'
import {useAddEmail} from './use-add-email'

const addEmailRpc = 'keybase.1.emails.addEmail'

afterEach(() => {
  cleanup()
  resetAllStores()
})

test('submitEmail rejects invalid addresses before hitting the service', async () => {
  const fake = installFakeEngine()
  const onSuccess = jest.fn()
  const {result} = renderHook(() => useAddEmail())

  act(() => {
    result.current.submitEmail('not-an-email', false, onSuccess)
  })
  await flush()

  expect(result.current.error).toBe('Invalid email address.')
  expect(fake.calls).toEqual([])
  expect(onSuccess).not.toHaveBeenCalled()

  act(() => {
    result.current.submitEmail('', false, onSuccess)
  })
  expect(result.current.error).toBe('Empty email address.')
})

test('submitEmail maps searchable to identity visibility and reports success once the service answers', async () => {
  const fake = installFakeEngine()
  const held = fake.hold(addEmailRpc)
  const onSuccess = jest.fn()
  const {result} = renderHook(() => useAddEmail())

  act(() => {
    result.current.submitEmail('testuser@example.com', true, onSuccess)
  })
  await flush()

  expect(held).toHaveLength(1)
  expect(held[0]!.params).toEqual(
    expect.objectContaining({email: 'testuser@example.com', visibility: T.RPCGen.IdentityVisibility.public})
  )
  expect(result.current.waiting).toBe(true)
  expect(onSuccess).not.toHaveBeenCalled()

  held[0]!.reply(null)
  await flush()
  expect(onSuccess).toHaveBeenCalledWith('testuser@example.com')
  expect(result.current.error).toBe('')
  expect(result.current.waiting).toBe(false)

  act(() => {
    result.current.submitEmail('testuser2@example.com', false, onSuccess)
  })
  await flush()
  expect(held[1]!.params).toEqual(
    expect.objectContaining({email: 'testuser2@example.com', visibility: T.RPCGen.IdentityVisibility.private})
  )
  held[1]!.reply(null)
  await flush()
})

test('submitEmail turns known RPC status codes into friendly errors', async () => {
  const fake = installFakeEngine()
  const held = fake.hold(addEmailRpc)
  const {result} = renderHook(() => useAddEmail())

  const submitAndFail = async (code: T.RPCGen.StatusCode) => {
    act(() => {
      result.current.submitEmail('testuser@example.com', false, jest.fn())
    })
    await flush()
    held.shift()!.reply(fakeError(code, 'failed'))
    await flush()
  }

  await submitAndFail(T.RPCGen.StatusCode.scratelimit)
  expect(result.current.error).toBe(
    "Sorry, you've added too many email addresses lately. Please try again later."
  )

  await submitAndFail(T.RPCGen.StatusCode.scemailtaken)
  expect(result.current.error).toBe('This email is already claimed by another user.')

  await submitAndFail(T.RPCGen.StatusCode.scemaillimitexceeded)
  expect(result.current.error).toBe('You have too many emails, delete one and try again.')

  await submitAndFail(T.RPCGen.StatusCode.scinputerror)
  expect(result.current.error).toBe('Invalid email.')
})

test('submitEmail falls back to the raw message for unknown errors and clearError resets', async () => {
  const fake = installFakeEngine()
  const held = fake.hold(addEmailRpc)
  const {result} = renderHook(() => useAddEmail())

  act(() => {
    result.current.submitEmail('testuser@example.com', false, jest.fn())
  })
  await flush()
  held[0]!.reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'something else broke'))
  await flush()
  expect(result.current.error).toBe('ERROR CODE 218 - something else broke in method keybase.1.emails.addEmail')

  act(() => {
    result.current.clearError()
  })
  expect(result.current.error).toBe('')
})
