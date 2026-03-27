/// <reference types="jest" />
import {resetAllStores} from '@/util/zustand'
import {useSettingsEmailState} from '../settings-email'

afterEach(() => {
  jest.restoreAllMocks()
  resetAllStores()
})

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

test('setAddedEmail stages the banner state until reset', () => {
  useSettingsEmailState.getState().dispatch.setAddedEmail('alice@example.com')

  expect(useSettingsEmailState.getState().addedEmail).toBe('alice@example.com')

  useSettingsEmailState.getState().dispatch.resetAddedEmail()

  expect(useSettingsEmailState.getState().addedEmail).toBe('')
})
