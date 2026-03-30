/// <reference types="jest" />
import * as S from '@/constants/strings'
import {clearSignupEmail, getSignupEmail, setSignupEmail} from '@/people/signup-email'
import {clearSignupDeviceNameDraft, getSignupDeviceNameDraft, setSignupDeviceNameDraft} from '@/signup/device-name-draft'

afterEach(() => {
  jest.restoreAllMocks()
  clearSignupEmail()
  clearSignupDeviceNameDraft()
})

test('device name draft stages the selected signup device name', () => {
  setSignupDeviceNameDraft('Phone 2')

  expect(getSignupDeviceNameDraft()).toBe('Phone 2')
})

test('device name draft clears back to the default', () => {
  setSignupDeviceNameDraft('Phone 2')
  clearSignupDeviceNameDraft()

  expect(getSignupDeviceNameDraft()).toBe(S.defaultDevicename)
})

test('signup email helper stores and clears the pending welcome email', () => {
  setSignupEmail('alice@example.com')
  expect(getSignupEmail()).toBe('alice@example.com')

  clearSignupEmail()

  expect(getSignupEmail()).toBe('')
})

test('signup email helper can stage the no-email sentinel', () => {
  setSignupEmail(S.noEmail)

  expect(getSignupEmail()).toBe(S.noEmail)
})
