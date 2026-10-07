/// <reference types="jest" />
import * as NavTree from '@/constants/nav-tree'
import * as T from '@/constants/types'
import {invalidPasswordErrorString} from '@/constants/config'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {useWaitingState} from '@/stores/waiting'
import {waitingKeyProvision} from '@/constants/strings'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {tick} from '@/test/flush'
import {installFakeNavigator, makeRootState, restoreNavigator, type FakeNavigator} from '@/test/fake-navigator'

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

let nav: FakeNavigator
let fake: FakeEngine

// Provisioning runs from a modal, so the fake starts with one open: clearModals only has
// something to dispatch when a modal is actually on screen. This one is never a
// navigation target below, so a replace onto another screen stays a replace.
const openModal = 'deviceAdd'

beforeEach(() => {
  nav = installFakeNavigator({
    modalRouteNames: [openModal],
    rootState: makeRootState({above: [{name: openModal}]}),
  })
  fake = installFakeEngine()
})

afterEach(() => {
  cancelProvision()
  restoreNavigator()
  resetAllStores()
})

// The listener hands incoming calls to their handlers on a timer, and a flow reading a dialog's events
// sees its end on another
const settle = async () => {
  for (let i = 0; i < 2; i++) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise(resolve => setTimeout(resolve, 0))
    // eslint-disable-next-line no-await-in-loop
    await tick()
  }
}

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

// Turning waiting on is throttled; turning it off is not
const waitingCount = () => {
  fake.engine._throttledDispatchWaitingAction.flush()
  return useWaitingState.getState().counts.get(waitingKeyProvision)
}

// The listener rejects with a plain Error that carries the RPCError as its cause, so the flow's
// `instanceof RPCError` routing below never runs on this code: every failure ends the run quietly.
// These are master's intended routes; they fail until the flow reads the RPCError.
describe('final error handling', () => {
  test.failing('an unknown username sends the user back to the username screen inline', async () => {
    const {reply} = await startAttempt()

    reply(fakeError(T.RPCGen.StatusCode.scnotfound, 'no such user'))
    await settle()

    expect(nav.navigations()).toContainEqual({
      name: 'username',
      params: {inlineErrorCode: T.RPCGen.StatusCode.scnotfound, username: 'testuser'},
      replace: true,
    })
    expect(nav.modalsCleared()).toBe(false)
  })

  test.failing('a malformed username also stays on the username screen', async () => {
    const {reply} = await startAttempt()

    reply(fakeError(T.RPCGen.StatusCode.scbadusername, 'bad username'))
    await settle()

    expect(nav.navigations()).toContainEqual({
      name: 'username',
      params: {inlineErrorCode: T.RPCGen.StatusCode.scbadusername, username: 'testuser'},
      replace: true,
    })
  })

  test.failing('any other error clears modals and shows the error screen with the rpc details', async () => {
    const {reply} = await startAttempt()

    reply(fakeError(T.RPCGen.StatusCode.scdeviceprovisionoffline, 'something broke'))
    await settle()

    expect(nav.modalsCleared()).toBe(true)
    expect(nav.navigations()).toContainEqual({
      name: 'error',
      params: {
        error: expect.objectContaining({
          code: T.RPCGen.StatusCode.scdeviceprovisionoffline,
          desc: 'something broke',
        }),
        username: 'testuser',
      },
      replace: true,
    })
  })

  test('an error caused by our own cancel shows nothing', async () => {
    const {reply} = await startAttempt()

    reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'Input canceled'))
    await settle()

    expect(nav.modalsCleared()).toBe(false)
    expect(nav.navigations()).toEqual([])
  })

  test('a kex cancel from the daemon shows nothing', async () => {
    const {reply} = await startAttempt()

    reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'kex canceled by caller'))
    await settle()

    expect(nav.modalsCleared()).toBe(false)
    expect(nav.navigations()).toEqual([])
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

    expect(nav.navigations()).toEqual([
      {name: 'password', params: {error: undefined, username: 'testuser'}, replace: false},
    ])
  })

  test('the service rejecting the password is rewritten to a readable error and replaces the screen', async () => {
    const {push} = await startAttempt()
    void pushPassphrase(push, T.RPCGen.PassphraseType.passPhrase, invalidPasswordErrorString)
    await settle()

    expect(nav.navigations()).toEqual([
      {name: 'password', params: {error: 'Incorrect password.', username: 'testuser'}, replace: true},
    ])
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
    expect(NavTree.visibleScreen(nav.getRootState())).toMatchObject({
      name: 'password',
      params: {error: 'Incorrect password.', username: 'testuser'},
    })
  })

  test('any other retry label is passed through verbatim', async () => {
    const {push} = await startAttempt()
    void pushPassphrase(push, T.RPCGen.PassphraseType.passPhrase, 'Try again')
    await settle()

    expect(nav.navigations()).toEqual([
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

    expect(nav.navigations()).toContainEqual({
      name: 'paperkey',
      params: {deviceName: 'paper key one', error: undefined},
      replace: false,
    })
  })

  test('a passphrase prompt of another kind is refused and shows nothing; the run goes on', async () => {
    const {push} = await startAttempt()
    const answered = pushPassphrase(push, T.RPCGen.PassphraseType.verifyPassPhrase)
    await settle()
    expect(nav.navigations()).toEqual([])
    await expect(answered).resolves.toEqual({
      error: {code: T.RPCGen.StatusCode.scinputcanceled, desc: 'Input canceled'},
    })
    void pushPassphrase(push, T.RPCGen.PassphraseType.passPhrase)
    await settle()
    expect(nav.navigations()).toEqual([
      {name: 'password', params: {error: undefined, username: 'testuser'}, replace: false},
    ])
  })
})

describe('text code prompt', () => {
  test('the submitted code is normalized to space separated words', async () => {
    const {push} = await startAttempt()
    const answered = push(secret, {phrase: 'one two three', previousErr: ''})
    await settle()

    expect(nav.navigations()).toEqual([
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

    expect(nav.navigations()).toEqual([
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
  expect(nav.navigations()).toContainEqual({
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
