/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import * as React from 'react'
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
import {NavigationContext, NavigationRouteContext} from '@react-navigation/core'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {tick} from '@/test/flush'
import {installFakeNavigator, makeRootState, restoreNavigator, type FakeNavigator} from '@/test/fake-navigator'
import {navigateAppend, navigateUp} from '@/constants/router'
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
const proxySettings = 'proxySettingsModal'
const errorModal = 'recoverPasswordErrorModal'

let nav: FakeNavigator
let fake: FakeEngine
let rendered: ReturnType<typeof render>

beforeEach(() => {
  useConfigState.getState().dispatch.setLoggedIn(true)
  nav = installFakeNavigator({modalRouteNames: [setPassword, proxySettings, errorModal], rootState: makeRootState()})
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
  rendered = render(<Password route={{params: {promptId, recoverRunId: 'r-0'}}} />)
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
  render(<Password route={{params: {promptId, recoverRunId: 'r-0'}}} />)
  expect(nav.types()).toEqual([])
  await end()
})

// A retry's setParams, or a restart onto the same mounted screen, changes its prompt with no mount or focus
test('a mounted screen whose params change to a prompt with nothing to answer closes itself', async () => {
  const {end, promptId} = await setup()
  const retryId = promptId + 1000
  const key = nav.getRootState()?.routes?.find(r => r.name === setPassword)?.key
  act(() => {
    nav.setRouteParams(key, {promptId: retryId})
  })
  nav.clearActions()

  rendered.rerender(<Password route={{params: {promptId: retryId, recoverRunId: 'r-0'}}} />)

  expect(nav.types()).toEqual(['GO_BACK'])
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

describe('on its route, after the run ended under a modal that is not the run\'s', () => {
  // The screen's navigation: its focus listeners, as the navigator calls them when it is on top again
  let focusListeners: Set<() => void>
  const navigation = {
    addListener: (type: string, cb: () => void) => {
      if (type !== 'focus') return () => {}
      focusListeners.add(cb)
      return () => focusListeners.delete(cb)
    },
  }
  const focus = () =>
    act(() => {
      for (const cb of [...focusListeners]) cb()
    })
  const screens = () => (nav.getRootState()?.routes ?? []).map(r => r.name)
  const setPasswordKey = () => {
    const key = (nav.getRootState()?.routes ?? []).find(r => r.name === setPassword)?.key
    if (!key) throw new Error('set-password is not in the root state')
    return key
  }
  const wasIOS = isIOS

  beforeEach(() => {
    focusListeners = new Set()
    // iOS keeps a covered modal of the run, which is what leaves the screen behind
    global.isIOS = true
  })
  afterEach(() => {
    global.isIOS = wasIOS
  })

  // Re-renders the mounted screen on its route in the root state, then covers it with proxy settings
  const onRouteCovered = (promptId: number) => {
    const key = setPasswordKey()
    rendered.rerender(
      <NavigationRouteContext value={{key, name: setPassword}}>
        <NavigationContext value={navigation as never}>
          <Password route={{params: {promptId, recoverRunId: 'r-0'}}} />
        </NavigationContext>
      </NavigationRouteContext>
    )
    act(() => {
      navigateAppend({name: proxySettings, params: {}} as never)
    })
    expect(screens()).toEqual(['loggedIn', setPassword, proxySettings])
  }
  const fail = async (held: ReturnType<FakeEngine['hold']>) =>
    act(async () => {
      held[0]!.reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'bad things'))
      await settle()
    })
  // The user takes the error and proxy settings away, and the screen is on top again
  const uncover = () => {
    act(() => {
      navigateUp()
      navigateUp()
    })
    expect(screens()).toEqual(['loggedIn', setPassword])
    nav.clearActions()
    focus()
  }

  test('an unanswered screen closes itself once it is focused again', async () => {
    let held: ReturnType<FakeEngine['hold']> = []
    const {promptId} = await setup((_, h) => {
      held = h
    })
    onRouteCovered(promptId)
    await fail(held)
    expect(screens()).toEqual(['loggedIn', setPassword, proxySettings, errorModal])

    uncover()

    expect(nav.types()).toEqual(['GO_BACK'])
    expect(screens()).toEqual(['loggedIn'])
    // A second focus before the back lands closes nothing more
    focus()
    expect(nav.types()).toEqual(['GO_BACK'])
  })

  test('an answered screen closes itself once it is focused again', async () => {
    let held: ReturnType<FakeEngine['hold']> = []
    const {answered, promptId} = await setup((_, h) => {
      held = h
    })
    fireEvent.click(screen.getByText('Save'))
    await expect(answered).resolves.toEqual({result: {passphrase: 'new password', storeSecret: true}})
    onRouteCovered(promptId)
    await fail(held)

    uncover()

    expect(nav.types()).toEqual(['GO_BACK'])
  })

  test('an answered screen stays when focused again while the service works on its answer', async () => {
    const {answered, end, promptId} = await setup()
    fireEvent.click(screen.getByText('Save'))
    await expect(answered).resolves.toEqual({result: {passphrase: 'new password', storeSecret: true}})
    onRouteCovered(promptId)

    act(() => navigateUp())
    nav.clearActions()
    focus()

    expect(nav.types()).toEqual([])
    await end()
  })

  test('an unanswered screen shown again after a hide closes itself, with no focus event', async () => {
    let held: ReturnType<FakeEngine['hold']> = []
    const {promptId} = await setup((_, h) => {
      held = h
    })
    onRouteCovered(promptId)
    const key = setPasswordKey()
    const shown = (mode: 'hidden' | 'visible') => (
      <NavigationRouteContext value={{key, name: setPassword}}>
        <NavigationContext value={navigation as never}>
          <React.Activity mode={mode}>
            <Password route={{params: {promptId, recoverRunId: 'r-0'}}} />
          </React.Activity>
        </NavigationContext>
      </NavigationRouteContext>
    )
    rendered.rerender(shown('hidden'))
    await fail(held)
    act(() => {
      navigateUp()
      navigateUp()
    })
    nav.clearActions()
    // The navigator's focus event came while the screen was hidden, its listener torn down
    focus()
    expect(nav.types()).toEqual([])

    rendered.rerender(shown('visible'))

    expect(nav.types()).toEqual(['GO_BACK'])
  })
})
