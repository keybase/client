/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useSettingsEmailState} from '../settings-email'

afterEach(() => {
  jest.restoreAllMocks()
  resetAllStores()
})

const flush = async () => new Promise<void>(resolve => setImmediate(resolve))

test('email change notifications populate the email map and verification updates the row', () => {
  useSettingsEmailState.getState().dispatch.notifyEmailAddressEmailsChanged([
    {
      email: 'alice@example.com',
      isPrimary: false,
      isVerified: false,
      lastVerifyEmailDate: 0,
      visibility: 0,
    } as any,
  ])

  expect(useSettingsEmailState.getState().emails.get('alice@example.com')?.isVerified).toBe(false)

  useSettingsEmailState.getState().dispatch.notifyEmailVerified('alice@example.com')

  expect(useSettingsEmailState.getState().emails.get('alice@example.com')?.isVerified).toBe(true)
  expect(useSettingsEmailState.getState().addedEmail).toBe('')
})

test('invalid emails fail locally without calling the RPC', () => {
  const addEmail = jest.spyOn(T.RPCGen, 'emailsAddEmailRpcPromise')

  useSettingsEmailState.getState().dispatch.addEmail('not-an-email', true)

  expect(useSettingsEmailState.getState().error).not.toBe('')
  expect(addEmail).not.toHaveBeenCalled()
})

test('successful addEmail updates the staged banner state', async () => {
  const addEmail = jest.spyOn(T.RPCGen, 'emailsAddEmailRpcPromise').mockResolvedValue(undefined as any)

  useSettingsEmailState.getState().dispatch.addEmail('alice@example.com', true)
  await flush()

  expect(addEmail).toHaveBeenCalledWith(
    {
      email: 'alice@example.com',
      visibility: T.RPCGen.IdentityVisibility.public,
    },
    expect.any(String)
  )
  expect(useSettingsEmailState.getState().addedEmail).toBe('alice@example.com')
  expect(useSettingsEmailState.getState().addingEmail).toBe('')
  expect(useSettingsEmailState.getState().error).toBe('')
})
