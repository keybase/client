/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {invalidPasswordErrorString} from '@/constants/config'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {useWaitingState} from '@/stores/waiting'
import {waitingKeyProvision} from '@/constants/strings'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {settle as settleTimers, tick} from '@/test/flush'
import logger from '@/logger'
import {installNavigation, makeRootState, type InstalledNavigation} from '@/test/navigation'

import {
  cancelProvision,
  startProvision,
  submitProvisionDeviceSelect,
  submitProvisionTextCode,
  submitProvisionUsername,
} from './flow'

const login = 'keybase.1.login.login'
const getPassphrase = 'keybase.1.secretUi.getPassphrase'
const secret = 'keybase.1.provisionUi.DisplayAndPromptSecret'
const exchanged = 'keybase.1.provisionUi.DisplaySecretExchanged'

let nav: InstalledNavigation
let fake: FakeEngine

// Provisioning runs from a modal, so the tree starts with one open under the username screen the
// attempt is submitted from: clearModals only has something to remove when a modal is on screen.
const openModal = 'deviceAdd'

beforeEach(() => {
  // The flow navigates from its own async work, as in the app, not from inside act(); test/flush
  // pulls in testing-library, which would otherwise make this an act environment.
  ;(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = false
  nav = installNavigation({
    rootState: makeRootState({above: [{name: openModal}, {name: 'username', params: {username: 'testuser'}}]}),
  })
  fake = installFakeEngine()
})

afterEach(() => {
  cancelProvision()
  jest.restoreAllMocks()
  resetAllStores()
})

// What the service sent crosses IPC, the listener hands incoming calls to their handlers on a timer,
// and a flow reading a dialog's events sees its end on another
const settle = async () => settleTimers(2)

const startAttempt = async () => {
  const held = fake.hold(login)
  fake.hold('keybase.1.config.getBootstrapStatus')
  submitProvisionUsername('testuser')
  await tick()
  expect(held).toHaveLength(1)
  const sessionID = fake.calls[0]!.params.sessionID as number
  const push = async (method: string, params: object) => fake.push(method, params, {sessionID})
  return {push, reply: held[0]!.reply}
}

const pushPassphrase = async (
  push: (method: string, params: object) => Promise<unknown>,
  type: T.RPCGen.PassphraseType,
  retryLabel = ''
) => {
  const answered = push(getPassphrase, {pinentry: {retryLabel, type}})
  await settle()
  return answered
}

// What the flow asked for: each push or replace it dispatched.
const navigations = () =>
  nav.actions
    .filter(a => a.type === 'PUSH' || a.type === 'REPLACE')
    .map(a => ({name: a.payload?.['name'], params: a.payload?.['params'], replace: a.type === 'REPLACE'}))
// The root stack's screens, from the library's state.
const rootNames = () => nav.getRootState()?.routes?.map(r => r.name)
const modalsCleared = () => !rootNames()?.includes(openModal)
const visible = () => nav.visibleScreen()

// Turning waiting on is throttled; turning it off is not
const waitingCount = () => {
  fake.engine._throttledDispatchWaitingAction.flush()
  return useWaitingState.getState().counts.get(waitingKeyProvision)
}

describe('final error handling', () => {
  test('an unknown username sends the user back to the username screen inline', async () => {
    const {reply} = await startAttempt()

    reply(fakeError(T.RPCGen.StatusCode.scnotfound, 'no such user'))
    await settle()

    // the username screen it was submitted from shows the error in place
    expect(visible()).toMatchObject({
      name: 'username',
      params: {inlineErrorCode: T.RPCGen.StatusCode.scnotfound, username: 'testuser'},
    })
    expect(rootNames()).toEqual(['loggedIn', openModal, 'username'])
    expect(modalsCleared()).toBe(false)
  })

  test('a malformed username also stays on the username screen', async () => {
    const {reply} = await startAttempt()

    reply(fakeError(T.RPCGen.StatusCode.scbadusername, 'bad username'))
    await settle()

    // the username screen it was submitted from shows the error in place
    expect(visible()).toMatchObject({
      name: 'username',
      params: {inlineErrorCode: T.RPCGen.StatusCode.scbadusername, username: 'testuser'},
    })
    expect(rootNames()).toEqual(['loggedIn', openModal, 'username'])
  })

  test('any other error clears modals and shows the error screen with the rpc details', async () => {
    const {reply} = await startAttempt()

    reply(fakeError(T.RPCGen.StatusCode.scdeviceprovisionoffline, 'something broke'))
    await settle()

    expect(modalsCleared()).toBe(true)
    expect(navigations()).toContainEqual({
      name: 'error',
      params: {
        error: expect.objectContaining({
          code: T.RPCGen.StatusCode.scdeviceprovisionoffline,
          desc: 'something broke',
        }),
        username: 'testuser',
      },
      replace: false,
    })
    // the error opens above the tabs; a replace here used to take loggedIn with it
    expect(rootNames()).toEqual(['loggedIn', 'error'])
    expect(visible()?.name).toBe('error')
  })

  test('an error caused by our own cancel shows nothing', async () => {
    const {reply} = await startAttempt()

    reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'Input canceled'))
    await settle()

    expect(modalsCleared()).toBe(false)
    expect(navigations()).toEqual([])
  })

  test('a kex cancel from the daemon shows nothing', async () => {
    const {reply} = await startAttempt()

    reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'kex canceled by caller'))
    await settle()

    expect(modalsCleared()).toBe(false)
    expect(navigations()).toEqual([])
  })

  test.each([
    ['an input cancel', T.RPCGen.StatusCode.scinputcanceled, 'canceled by the service'],
    ['a session cancel', T.RPCGen.StatusCode.sccanceled, 'Received RPC cancel for session'],
  ])('a cancel from the service (%s) ends the run quietly', async (_, code, desc) => {
    const logError = jest.spyOn(logger, 'error')
    const {reply} = await startAttempt()

    reply(fakeError(code, desc))
    await settle()

    expect(modalsCleared()).toBe(false)
    expect(navigations()).toEqual([])
    expect(logError).not.toHaveBeenCalled()
  })

  test('a lost service connection shows the error screen', async () => {
    await startAttempt()

    fake.drop()
    await settle()

    expect(modalsCleared()).toBe(true)
    expect(navigations()).toContainEqual(
      expect.objectContaining({name: 'error', params: expect.objectContaining({username: 'testuser'})})
    )
    expect(visible()?.name).toBe('error')
  })

  test('a lost service connection ends the run', async () => {
    const {push} = await startAttempt()
    const password = pushPassphrase(push, T.RPCGen.PassphraseType.passPhrase)
    await settle()

    fake.drop()
    await expect(password).resolves.toEqual({
      error: expect.objectContaining({desc: 'The service connection was lost', kind: {reason: 'disconnect', type: 'cancelled'}}),
    })
    await settle()
    fake.restart()
    // the run is over: a submit reaches nothing and nothing starts again
    submitProvisionTextCode('one two three')
    await settle()
    expect(fake.calls.filter(c => c.method === login)).toHaveLength(1)
  })
})

describe('passphrase prompts', () => {
  test('a password prompt navigates to the password screen', async () => {
    const {push} = await startAttempt()
    void pushPassphrase(push, T.RPCGen.PassphraseType.passPhrase)
    await settle()

    expect(navigations()).toEqual([
      {name: 'password', params: {error: undefined, username: 'testuser'}, replace: false},
    ])
    expect(rootNames()).toEqual(['loggedIn', openModal, 'username', 'password'])
  })

  test('the service rejecting the password is rewritten to a readable error and replaces the screen', async () => {
    const {push} = await startAttempt()
    void pushPassphrase(push, T.RPCGen.PassphraseType.passPhrase, invalidPasswordErrorString)
    await settle()

    expect(navigations()).toEqual([
      {name: 'password', params: {error: 'Incorrect password.', username: 'testuser'}, replace: true},
    ])
    expect(rootNames()).toEqual(['loggedIn', openModal, 'password'])
  })

  // In the app the retry prompt arrives while the password screen from the first prompt is
  // still showing, so it retargets that screen in place rather than swapping it.
  test('a retry while the password screen is showing updates that screen in place', async () => {
    const {push} = await startAttempt()
    void pushPassphrase(push, T.RPCGen.PassphraseType.passPhrase)
    await settle()
    nav.clearActions()
    void pushPassphrase(push, T.RPCGen.PassphraseType.passPhrase, invalidPasswordErrorString)
    await settle()

    expect(nav.types()).toEqual(['SET_PARAMS'])
    expect(visible()).toMatchObject({
      name: 'password',
      params: {error: 'Incorrect password.', username: 'testuser'},
    })
  })

  test('any other retry label is passed through verbatim', async () => {
    const {push} = await startAttempt()
    void pushPassphrase(push, T.RPCGen.PassphraseType.passPhrase, 'Try again')
    await settle()

    expect(navigations()).toEqual([
      {name: 'password', params: {error: 'Try again', username: 'testuser'}, replace: true},
    ])
  })

  test('a paper key prompt names the device the user picked', async () => {
    const {push} = await startAttempt()

    const choose = push('keybase.1.provisionUi.chooseDevice', {
      devices: [{deviceID: 'device-1', deviceNumberOfType: 1, name: 'paper key one', type: 'backup'}],
    })
    await settle()
    submitProvisionDeviceSelect('paper key one')
    await choose
    void pushPassphrase(push, T.RPCGen.PassphraseType.paperKey)
    await settle()

    expect(navigations()).toContainEqual({
      name: 'paperkey',
      params: {deviceName: 'paper key one', error: undefined},
      replace: false,
    })
  })

  test('a passphrase prompt of another kind is refused and shows nothing; the run goes on', async () => {
    const {push} = await startAttempt()
    const answered = pushPassphrase(push, T.RPCGen.PassphraseType.verifyPassPhrase)
    await settle()
    expect(navigations()).toEqual([])
    await expect(answered).resolves.toEqual({
      error: {code: T.RPCGen.StatusCode.scinputcanceled, desc: 'Input canceled'},
    })
    void pushPassphrase(push, T.RPCGen.PassphraseType.passPhrase)
    await settle()
    expect(navigations()).toEqual([
      {name: 'password', params: {error: undefined, username: 'testuser'}, replace: false},
    ])
  })
})

describe('text code prompt', () => {
  test('the submitted code is normalized to space separated words', async () => {
    const {push} = await startAttempt()
    const answered = push(secret, {phrase: 'one two three', previousErr: ''})
    await settle()

    expect(navigations()).toEqual([
      {
        name: 'codePage',
        params: {
          deviceName: '',
          error: undefined,
          otherDevice: expect.objectContaining({name: ''}),
          textCode: 'one two three',
        },
        replace: false,
      },
    ])

    submitProvisionTextCode('  one,two\n\nthree  ')

    await expect(answered).resolves.toEqual({result: {phrase: 'one two three', secret: null}})
  })

  test('a previous error replaces the code screen and is shown', async () => {
    const {push} = await startAttempt()
    void push(secret, {phrase: 'four five six', previousErr: 'nope'})
    await settle()

    expect(navigations()).toEqual([
      expect.objectContaining({
        name: 'codePage',
        params: expect.objectContaining({error: 'nope', textCode: 'four five six'}),
        replace: true,
      }),
    ])
  })

  test('a code submitted with no secret prompt open starts the login over', async () => {
    await startAttempt()
    submitProvisionTextCode('one two three')
    await settle()
    expect(fake.calls.filter(c => c.method === login)).toHaveLength(2)
  })
})

describe('waiting', () => {
  test('the login holds the provision waiting key while the service works, not while a prompt waits', async () => {
    const {push, reply} = await startAttempt()
    await settle()
    expect(waitingCount()).toBe(1)
    const answered = push(secret, {phrase: 'one two three', previousErr: ''})
    await settle()
    expect(waitingCount()).toBeUndefined()
    submitProvisionTextCode('one two three')
    await answered
    await settle()
    expect(waitingCount()).toBe(1)
    reply(undefined)
    await settle()
    expect(waitingCount()).toBeUndefined()
  })

  test('secret-exchange progress keeps waiting on over a held prompt until the attempt ends', async () => {
    const {push, reply} = await startAttempt()
    void push(secret, {phrase: 'one two three', previousErr: ''})
    await settle()
    expect(waitingCount()).toBeUndefined()

    await push(exchanged, {})
    await push(exchanged, {})
    await settle()
    expect(waitingCount()).toBe(1)

    reply(undefined)
    await settle()

    expect(waitingCount()).toBeUndefined()
  })

  test('secret-exchange progress is released when the attempt is cancelled', async () => {
    const {push} = await startAttempt()
    void push(secret, {phrase: 'one two three', previousErr: ''})
    await push(exchanged, {})
    await settle()
    expect(waitingCount()).toBe(1)

    cancelProvision()
    await settle()
    expect(waitingCount()).toBeUndefined()
  })

  test('a secret-exchange arriving with the attempt ending does not leak a waiting count', async () => {
    const {push, reply} = await startAttempt()

    // the service sends it and then the reply, before the GUI's handler ran
    void push(exchanged, {})
    reply(undefined)
    await settle()
    await settle()

    expect(waitingCount()).toBeUndefined()
  })
})

test('starting provisioning while logged in logs out first', async () => {
  fake.answer('keybase.1.login.logout', () => undefined)
  useConfigState.getState().dispatch.setLoggedIn(true)

  startProvision('testuser')
  await settle()

  expect(fake.calls).toEqual([
    {method: 'keybase.1.login.logout', params: expect.objectContaining({force: false, keepSecrets: true})},
  ])
  expect(navigations()).toContainEqual({
    name: 'username',
    params: {fromReset: false, username: 'testuser'},
    replace: false,
  })
})

test('starting provisioning while logged out does not log out', async () => {
  startProvision('testuser')
  await settle()

  expect(fake.calls).toEqual([])
})
