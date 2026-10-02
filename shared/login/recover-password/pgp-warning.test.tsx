/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'
import * as T from '@/constants/types'
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
import {NavigationContext} from '@react-navigation/core'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {installFakeEngine} from '@/test/fake-engine'
import {tick} from '@/test/flush'
import {installFakeNavigator, makeRootState, restoreNavigator, type FakeNavigator} from '@/test/fake-navigator'
import {declineRecoverPasswordPrompt, isRecoverPasswordPromptOpen, startRecoverPassword} from './flow'
import PgpWarning from './pgp-warning'

jest.mock('@/provision/flow', () => ({cancelProvision: () => {}, startProvision: () => {}}))

// The real components need native/electron rendering; only the Continue button matters here.
jest.mock('@/common-adapters', () => {
  const React = require('react')
  const passThrough = ({children}: {children?: React.ReactNode}) =>
    React.createElement('div', null, children)
  return {
    Box2: passThrough,
    Button: ({label, onClick}: {label?: string; onClick?: () => void}) =>
      React.createElement('button', {onClick, type: 'button'}, label),
    ButtonBar: passThrough,
    ModalFooter: passThrough,
    ScrollView: passThrough,
    Styles: {
      createStyleHook: () => () => ({}),
      globalStyles: {flexOne: {}},
      isTablet: false,
    },
    Text: passThrough,
  }
})

type BeforeRemove = (e: {data: {action: {type: string}}}) => void

let nav: FakeNavigator
let beforeRemove: BeforeRemove | undefined

beforeEach(() => {
  beforeRemove = undefined
  useConfigState.getState().dispatch.setLoggedIn(true)
  nav = installFakeNavigator({modalRouteNames: ['recoverPasswordPgpWarning'], rootState: makeRootState()})
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

// Starts a run, has Go ask, and renders the warning the flow pushed inside a screen's navigation context.
// `before` runs between the push and the screen mounting, as a deferred mount would see it.
const setup = async (before?: (id: number) => void) => {
  const fake = installFakeEngine()
  const held = fake.hold('keybase.1.login.recoverPassphrase')
  startRecoverPassword({username: 'testuser'})
  await tick()
  const sessionID = fake.calls[0]!.params.sessionID as number
  const answered = fake.push(
    'keybase.1.loginUi.promptPassphraseRecovery',
    {kind: T.RPCGen.PassphraseRecoveryPromptType.encryptedPgpKeys},
    {sessionID}
  )
  await settle()
  const pushed = nav.pushes().find(p => p.name === 'recoverPasswordPgpWarning')
  const id = (pushed?.params as {promptId: number}).promptId
  before?.(id)
  nav.clearActions()
  const navigation = {
    addListener: (type: string, cb: BeforeRemove) => {
      if (type === 'beforeRemove') beforeRemove = cb
      return () => {}
    },
  }
  render(
    <NavigationContext value={navigation as never}>
      <PgpWarning route={{params: {promptId: id}}} />
    </NavigationContext>
  )
  // Settles the run, which also clears the decline timer of a prompt left pending
  const end = async () => {
    held[0]!.reply(undefined)
    await settle()
  }
  return {answered, end, id}
}

const remove = (type: string) => act(() => beforeRemove?.({data: {action: {type}}}))

test('Continue answers true once and closes the warning', async () => {
  const {answered, end} = await setup()

  fireEvent.click(screen.getByText('Continue'))
  // Closing the warning is not a second answer; the fake fails the test if one reached the service
  remove('GO_BACK')
  fireEvent.click(screen.getByText('Continue'))

  await expect(answered).resolves.toEqual({result: true})
  expect(nav.types()[0]).toBe('GO_BACK')
  await end()
})

test.each(['GO_BACK', 'POP', 'REMOVE'])('the user taking the warning away (%s) answers false once', async type => {
  const {answered, end} = await setup()

  remove(type)
  remove(type)

  await expect(answered).resolves.toEqual({result: false})
  await end()
})

test('an app-initiated reset removing the warning is not an answer', async () => {
  const {end, id} = await setup()

  remove('RESET')

  expect(isRecoverPasswordPromptOpen(id)).toBe(true)
  await end()
})

test('a warning whose prompt was settled before it mounted closes itself without a second answer', async () => {
  const {answered, end} = await setup(id => declineRecoverPasswordPrompt(id))

  expect(nav.types()).toEqual(['GO_BACK'])
  fireEvent.click(screen.getByText('Continue'))

  await expect(answered).resolves.toEqual({result: false})
  await end()
})

test('a warning whose prompt was settled leaves the screen above it alone when covered', async () => {
  const {end} = await setup(id => {
    declineRecoverPasswordPrompt(id)
    nav.setRootState(
      makeRootState({above: [{name: 'recoverPasswordPgpWarning', params: {promptId: id}}, {name: 'proxySettingsModal'}]})
    )
  })

  expect(nav.types()).toEqual([])
  await end()
})

test('a warning for a still-pending prompt stays open on mount', async () => {
  const {end} = await setup()

  expect(nav.types()).toEqual([])
  await end()
})
