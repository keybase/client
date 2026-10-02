/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {tick} from '@/test/flush'
import {installFakeNavigator, makeRootState, restoreNavigator, type FakeNavigator} from '@/test/fake-navigator'
import {startRecoverPassword} from './flow'
import Password from './password'

jest.mock('@/provision/flow', () => ({cancelProvision: () => {}, startProvision: () => {}}))

// The real form needs native/electron rendering; only its Save matters here.
jest.mock('@/settings/password', () => {
  const React = require('react')
  return {
    UpdatePassword: ({onSave}: {onSave: (p: string) => void}) =>
      React.createElement('button', {onClick: () => onSave('new password'), type: 'button'}, 'Save'),
  }
})

const recover = 'keybase.1.login.recoverPassphrase'
const setPassword = 'recoverPasswordSetPassword'

let nav: FakeNavigator
let fake: FakeEngine

beforeEach(() => {
  useConfigState.getState().dispatch.setLoggedIn(true)
  nav = installFakeNavigator({modalRouteNames: [setPassword, 'proxySettingsModal'], rootState: makeRootState()})
})

afterEach(() => {
  cleanup()
  restoreNavigator()
  resetAllStores()
})

// The listener hands incoming calls to their handlers on a timer, and the flow reads them off the
// dialog's events after that
const settle = async () => {
  await new Promise(resolve => setTimeout(resolve, 0))
  await tick()
}

// Starts a run, has Go ask for the new password, and renders the screen the flow pushed.
// `before` runs between the push and the screen mounting, as a deferred mount would see it.
const setup = async (before?: (promptId: number, held: ReturnType<FakeEngine['hold']>) => Promise<void> | void) => {
  fake = installFakeEngine()
  const held = fake.hold(recover)
  startRecoverPassword({username: 'testuser'})
  await tick()
  const sessionID = fake.calls[0]!.params.sessionID as number
  const answered = fake.push(
    'keybase.1.secretUi.getPassphrase',
    {pinentry: {retryLabel: '', type: T.RPCGen.PassphraseType.passPhrase}},
    {sessionID}
  )
  await settle()
  const pushed = nav.pushes().find(p => p.name === setPassword)
  const promptId = (pushed?.params as {promptId: number}).promptId
  await before?.(promptId, held)
  nav.clearActions()
  render(<Password route={{params: {promptId}}} />)
  // The run's waiting state changes as it ends, which the mounted screen renders
  const end = async () =>
    act(async () => {
      held[0]!.reply(undefined)
      await settle()
    })
  return {answered, end, promptId}
}

test('a screen whose prompt is still open stays and its Save answers', async () => {
  const {answered, end} = await setup()

  expect(nav.types()).toEqual([])
  fireEvent.click(screen.getByText('Save'))

  await expect(answered).resolves.toEqual({result: {passphrase: 'new password', storeSecret: true}})
  await end()
})

test('a screen that answered stays when its effects run again while the service works on it', async () => {
  const {answered, end, promptId} = await setup()
  fireEvent.click(screen.getByText('Save'))
  await expect(answered).resolves.toEqual({result: {passphrase: 'new password', storeSecret: true}})
  // Unfreezing a screen or a hot reload runs its effects again; a remount is the same here
  cleanup()
  render(<Password route={{params: {promptId}}} />)
  expect(nav.types()).toEqual([])
  await end()
})

test('a screen whose run was restarted before it mounted closes itself', async () => {
  await setup(async () => {
    startRecoverPassword({username: 'testuser'})
    await tick()
  })

  expect(nav.types()).toEqual(['GO_BACK'])
})

test('a screen whose run was cancelled before it mounted closes itself', async () => {
  await setup(async (_, held) => {
    held[0]!.reply(fakeError(T.RPCGen.StatusCode.sccanceled, 'Canceling RPC'))
    await settle()
  })

  expect(nav.types()).toEqual(['GO_BACK'])
})

test('a screen whose prompt settled leaves the screen above it alone when covered', async () => {
  await setup(async promptId => {
    startRecoverPassword({username: 'testuser'})
    await tick()
    nav.setRootState(
      makeRootState({above: [{name: setPassword, params: {promptId}}, {name: 'proxySettingsModal'}]})
    )
  })

  expect(nav.types()).toEqual([])
})

test("a screen whose prompt settled leaves a newer run's set-password above it alone", async () => {
  await setup(async promptId => {
    startRecoverPassword({username: 'testuser'})
    await tick()
    nav.setRootState(
      makeRootState({
        above: [
          {name: setPassword, params: {promptId}},
          {name: setPassword, params: {promptId: promptId + 1000}},
        ],
      })
    )
  })

  expect(nav.types()).toEqual([])
})
