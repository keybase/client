/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'
import * as T from '@/constants/types'
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
import {NavigationContext} from '@react-navigation/core'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {installFakeNavigator, makeRootState, restoreNavigator, type FakeNavigator} from '@/test/fake-navigator'
import {startRecoverPassword} from './flow'
import PgpWarning from './pgp-warning'

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
  jest.restoreAllMocks()
  resetAllStores()
})

const flush = async () => new Promise<void>(resolve => setTimeout(resolve, 0))

// Starts a run, has Go ask, and renders the warning inside a screen's navigation context.
const setup = async () => {
  let listener: Parameters<typeof T.RPCGen.loginRecoverPassphraseRpcListener>[0] | undefined
  jest.spyOn(T.RPCGen, 'loginRecoverPassphraseRpcListener').mockImplementation(async l => {
    listener = l
    await new Promise<void>(() => {})
    return undefined as any
  })
  startRecoverPassword({username: 'testuser'})
  await flush()
  const response = {error: jest.fn(), result: jest.fn()}
  listener?.customResponseIncomingCallMap?.['keybase.1.loginUi.promptPassphraseRecovery']?.(
    {kind: T.RPCGen.PassphraseRecoveryPromptType.encryptedPgpKeys} as any,
    response as any
  )
  const navigation = {
    addListener: (type: string, cb: BeforeRemove) => {
      if (type === 'beforeRemove') beforeRemove = cb
      return () => {}
    },
  }
  render(
    <NavigationContext value={navigation as never}>
      <PgpWarning />
    </NavigationContext>
  )
  return response
}

const remove = (type: string) => act(() => beforeRemove?.({data: {action: {type}}}))

test('Continue answers true once and closes the warning', async () => {
  const response = await setup()
  nav.clearActions()

  fireEvent.click(screen.getByText('Continue'))
  // Closing the warning is not a second answer.
  remove('GO_BACK')
  fireEvent.click(screen.getByText('Continue'))

  expect(response.result).toHaveBeenCalledTimes(1)
  expect(response.result).toHaveBeenCalledWith(true)
  expect(nav.types()[0]).toBe('GO_BACK')
})

test.each(['GO_BACK', 'POP', 'REMOVE'])('the user taking the warning away (%s) answers false once', async type => {
  const response = await setup()

  remove(type)
  remove(type)

  expect(response.result).toHaveBeenCalledTimes(1)
  expect(response.result).toHaveBeenCalledWith(false)
})

test('an app-initiated reset removing the warning is not an answer', async () => {
  const response = await setup()

  remove('RESET')

  expect(response.result).not.toHaveBeenCalled()
})
