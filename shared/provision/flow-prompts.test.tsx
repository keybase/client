/// <reference types="jest" />
import * as T from '@/constants/types'
import {invalidPasswordErrorString} from '@/constants/config'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {useWaitingState} from '@/stores/waiting'
import {waitingKeyProvision} from '@/constants/strings'
import {RPCError} from '@/util/errors'

import {
  cancelProvision,
  startProvision,
  submitProvisionDeviceSelect,
  submitProvisionTextCode,
  submitProvisionUsername,
} from './flow'

import {installFakeNavigator, makeRootState, restoreNavigator, type FakeNavigator} from '@/test/fake-navigator'

let nav: FakeNavigator

// Provisioning runs from a modal, so the fake starts with one open: clearModals only has
// something to dispatch when a modal is actually on screen. This one is never a
// navigation target below, so a replace onto another screen stays a replace.
const openModal = 'deviceAdd'

beforeEach(() => {
  nav = installFakeNavigator({
    modalRouteNames: [openModal],
    rootState: makeRootState({above: [{name: openModal}]}),
  })
})

afterEach(() => {
  restoreNavigator()
  cancelProvision()
  jest.restoreAllMocks()
  resetAllStores()
})

const flush = async () => new Promise<void>(resolve => setImmediate(resolve))

type Listener = Parameters<typeof T.RPCGen.loginLoginRpcListener>[0]

const makeRpcDevice = (name: string, deviceID: string, type: 'mobile' | 'desktop' | 'backup') =>
  ({
    deviceID,
    deviceNumberOfType: 1,
    name,
    type,
  }) as any

// Each loginLogin call hangs until the test rejects/resolves it, like the real RPC waiting on prompts.
const mockLoginAttempts = () => {
  const attempts: Array<{
    listener: Listener
    reject: (e: unknown) => void
    resolve: () => void
  }> = []
  jest.spyOn(T.RPCGen, 'loginLoginRpcListener').mockImplementation(async listener => {
    await new Promise<void>((resolve, reject) => {
      attempts.push({listener, reject, resolve})
    })
    return undefined as any
  })
  return attempts
}

const startAttempt = async () => {
  const attempts = mockLoginAttempts()
  submitProvisionUsername('testuser')
  await flush()
  expect(attempts.length).toBe(1)
  return attempts[0]!
}

describe('final error handling', () => {
  test('an unknown username sends the user back to the username screen inline', async () => {
    const attempt = await startAttempt()

    attempt.reject(new RPCError('no such user', T.RPCGen.StatusCode.scnotfound))
    await flush()

    expect(nav.navigations()).toContainEqual({
      name: 'username',
      params: {inlineErrorCode: T.RPCGen.StatusCode.scnotfound, username: 'testuser'},
      replace: true,
    })
    expect(nav.modalsCleared()).toBe(false)
  })

  test('a malformed username also stays on the username screen', async () => {
    const attempt = await startAttempt()

    attempt.reject(new RPCError('bad username', T.RPCGen.StatusCode.scbadusername))
    await flush()

    expect(nav.navigations()).toContainEqual({
      name: 'username',
      params: {inlineErrorCode: T.RPCGen.StatusCode.scbadusername, username: 'testuser'},
      replace: true,
    })
  })

  test('any other error clears modals and shows the error screen with the rpc details', async () => {
    const attempt = await startAttempt()

    const error = new RPCError('something broke', T.RPCGen.StatusCode.scdeviceprovisionoffline, [
      {key: 'has_active_device', value: '1'},
    ])
    attempt.reject(error)
    await flush()

    expect(nav.modalsCleared()).toBe(true)
    expect(nav.navigations()).toContainEqual({
      name: 'error',
      params: {
        error: {
          code: T.RPCGen.StatusCode.scdeviceprovisionoffline,
          desc: error.desc,
          details: error.details,
          fields: [{key: 'has_active_device', value: '1'}],
          message: error.message,
        },
        username: 'testuser',
      },
      replace: true,
    })
  })

  test('an error caused by our own cancel shows nothing', async () => {
    const attempt = await startAttempt()

    attempt.reject(new RPCError('Input canceled', T.RPCGen.StatusCode.scgeneric))
    await flush()

    expect(nav.modalsCleared()).toBe(false)
    expect(nav.navigations()).not.toContainEqual(expect.objectContaining({name: 'error', replace: true}))
  })

  test('a kex cancel from the daemon shows nothing', async () => {
    const attempt = await startAttempt()

    attempt.reject(new RPCError('kex canceled by caller', T.RPCGen.StatusCode.scgeneric))
    await flush()

    expect(nav.navigations()).not.toContainEqual(expect.objectContaining({name: 'error', replace: true}))
  })

  test('a non-rpc failure does not navigate anywhere', async () => {
    const attempt = await startAttempt()

    attempt.reject(new Error('boom'))
    await flush()

    expect(nav.modalsCleared()).toBe(false)
    expect(nav.navigations()).not.toContainEqual(expect.objectContaining({name: 'error', replace: true}))
  })
})

describe('passphrase prompts', () => {
  test('a password prompt navigates to the password screen', async () => {
    const attempt = await startAttempt()

    const response = {error: jest.fn(), result: jest.fn()}
    attempt.listener.customResponseIncomingCallMap?.['keybase.1.secretUi.getPassphrase']?.(
      {pinentry: {retryLabel: '', type: T.RPCGen.PassphraseType.passPhrase}} as any,
      response as any
    )

    expect(nav.navigations()).toContainEqual({
      name: 'password',
      params: {error: undefined, username: 'testuser'},
      replace: false,
    })
  })

  test('the service rejecting the password is rewritten to a readable error and replaces the screen', async () => {
    const attempt = await startAttempt()

    const response = {error: jest.fn(), result: jest.fn()}
    attempt.listener.customResponseIncomingCallMap?.['keybase.1.secretUi.getPassphrase']?.(
      {pinentry: {retryLabel: invalidPasswordErrorString, type: T.RPCGen.PassphraseType.passPhrase}} as any,
      response as any
    )

    expect(nav.navigations()).toContainEqual({
      name: 'password',
      params: {error: 'Incorrect password.', username: 'testuser'},
      replace: true,
    })
  })

  test('any other retry label is passed through verbatim', async () => {
    const attempt = await startAttempt()

    const response = {error: jest.fn(), result: jest.fn()}
    attempt.listener.customResponseIncomingCallMap?.['keybase.1.secretUi.getPassphrase']?.(
      {pinentry: {retryLabel: 'Try again', type: T.RPCGen.PassphraseType.passPhrase}} as any,
      response as any
    )

    expect(nav.navigations()).toContainEqual({
      name: 'password',
      params: {error: 'Try again', username: 'testuser'},
      replace: true,
    })
  })

  test('a paper key prompt names the device the user picked', async () => {
    const attempt = await startAttempt()

    const chooseResponse = {error: jest.fn(), result: jest.fn()}
    attempt.listener.customResponseIncomingCallMap?.['keybase.1.provisionUi.chooseDevice']?.(
      {devices: [makeRpcDevice('paper key one', 'device-1', 'backup')]} as any,
      chooseResponse as any
    )
    submitProvisionDeviceSelect('paper key one')

    const response = {error: jest.fn(), result: jest.fn()}
    attempt.listener.customResponseIncomingCallMap?.['keybase.1.secretUi.getPassphrase']?.(
      {pinentry: {retryLabel: '', type: T.RPCGen.PassphraseType.paperKey}} as any,
      response as any
    )

    expect(nav.navigations()).toContainEqual({
      name: 'paperkey',
      params: {deviceName: 'paper key one', error: undefined},
      replace: false,
    })
  })
})

describe('text code prompt', () => {
  test('the submitted code is normalized to space separated words', async () => {
    const attempt = await startAttempt()

    const response = {error: jest.fn(), result: jest.fn()}
    attempt.listener.customResponseIncomingCallMap?.['keybase.1.provisionUi.DisplayAndPromptSecret']?.(
      {phrase: 'one two three', previousErr: ''} as any,
      response as any
    )

    expect(nav.navigations()).toContainEqual({
      name: 'codePage',
      params: {
        deviceName: '',
        error: undefined,
        otherDevice: expect.objectContaining({name: ''}),
        textCode: 'one two three',
      },
      replace: false,
    })

    submitProvisionTextCode('  one,two\n\nthree  ')

    expect(response.result).toHaveBeenCalledWith({phrase: 'one two three', secret: null})
  })

  test('a previous error replaces the code screen and is shown', async () => {
    const attempt = await startAttempt()

    const response = {error: jest.fn(), result: jest.fn()}
    attempt.listener.customResponseIncomingCallMap?.['keybase.1.provisionUi.DisplayAndPromptSecret']?.(
      {phrase: 'four five six', previousErr: 'nope'} as any,
      response as any
    )

    expect(nav.navigations()).toContainEqual(
      expect.objectContaining({
        name: 'codePage',
        params: expect.objectContaining({error: 'nope', textCode: 'four five six'}),
        replace: true,
      })
    )
  })
})

test('secret-exchange progress is released when the attempt ends', async () => {
  const attempt = await startAttempt()

  const exchanged = attempt.listener.incomingCallMap['keybase.1.provisionUi.DisplaySecretExchanged']
  exchanged?.({} as any)
  exchanged?.({} as any)
  expect(useWaitingState.getState().counts.get(waitingKeyProvision)).toBe(2)

  attempt.resolve()
  await flush()

  expect(useWaitingState.getState().counts.get(waitingKeyProvision)).toBeUndefined()
})

test('a secret-exchange arriving after the attempt ended does not leak a waiting count', async () => {
  const attempt = await startAttempt()
  const exchanged = attempt.listener.incomingCallMap['keybase.1.provisionUi.DisplaySecretExchanged']

  attempt.resolve()
  await flush()

  exchanged?.({} as any)

  expect(useWaitingState.getState().counts.get(waitingKeyProvision)).toBeUndefined()
})

test('starting provisioning while logged in logs out first', async () => {
  const logout = jest.spyOn(T.RPCGen, 'loginLogoutRpcPromise').mockResolvedValue(undefined as any)
  useConfigState.getState().dispatch.setLoggedIn(true)

  startProvision('testuser')
  await flush()

  expect(logout).toHaveBeenCalledWith({force: false, keepSecrets: true}, 'config:loginAsOther')
  expect(nav.navigations()).toContainEqual({
    name: 'username',
    params: {fromReset: false, username: 'testuser'},
    replace: false,
  })
})

test('starting provisioning while logged out does not log out', async () => {
  const logout = jest.spyOn(T.RPCGen, 'loginLogoutRpcPromise').mockResolvedValue(undefined as any)

  startProvision('testuser')
  await flush()

  expect(logout).not.toHaveBeenCalled()
})
