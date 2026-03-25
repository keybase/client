/// <reference types="jest" />

import {
  getLoggedOutBannerMessage,
  getReloginNeedPassword,
  getRootLoginMode,
  isNeedPasswordError,
  needPasswordError,
} from './flow'

test('getRootLoginMode preserves the logged-out routing priority', () => {
  expect(
    getRootLoginMode({
      configuredAccountsLength: 2,
      handshakeState: 'done',
      isLoggedIn: true,
      userSwitching: false,
    })
  ).toBe('hidden')

  expect(
    getRootLoginMode({
      configuredAccountsLength: 2,
      handshakeState: 'starting',
      isLoggedIn: false,
      userSwitching: false,
    })
  ).toBe('loading')

  expect(
    getRootLoginMode({
      configuredAccountsLength: 2,
      handshakeState: 'done',
      isLoggedIn: false,
      userSwitching: true,
    })
  ).toBe('loading')

  expect(
    getRootLoginMode({
      configuredAccountsLength: 2,
      handshakeState: 'done',
      isLoggedIn: false,
      userSwitching: false,
    })
  ).toBe('relogin')

  expect(
    getRootLoginMode({
      configuredAccountsLength: 0,
      handshakeState: 'done',
      isLoggedIn: false,
      userSwitching: false,
    })
  ).toBe('intro')
})

test('getLoggedOutBannerMessage prefers deletion, then revocation, then nothing', () => {
  expect(
    getLoggedOutBannerMessage({justDeletedSelf: 'alice', justRevokedSelf: 'bob'})
  ).toBe('Your Keybase account alice has been deleted. Au revoir!')
  expect(getLoggedOutBannerMessage({justDeletedSelf: '', justRevokedSelf: 'bob'})).toBe(
    'bob was revoked successfully'
  )
  expect(getLoggedOutBannerMessage({justDeletedSelf: '', justRevokedSelf: ''})).toBe('')
})

test('relogin password helpers preserve the stored-secret and empty-passphrase branches', () => {
  expect(getReloginNeedPassword(true, false)).toBe(false)
  expect(getReloginNeedPassword(false, false)).toBe(true)
  expect(getReloginNeedPassword(true, true)).toBe(true)
  expect(isNeedPasswordError(needPasswordError)).toBe(true)
  expect(isNeedPasswordError('Incorrect password.')).toBe(false)
})
