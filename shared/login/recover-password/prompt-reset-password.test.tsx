/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'
import * as T from '@/constants/types'
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
import {NavigationContext} from '@react-navigation/core'
import {resetAllStores} from '@/util/zustand'
import {installFakeEngine} from '@/test/fake-engine'
import {tick} from '@/test/flush'
import {makeFakeRoute} from '@/test/fake-route'
import {installFakeNavigator, makeRootState, restoreNavigator, type FakeNavigator} from '@/test/fake-navigator'
import {navigateUp} from '@/constants/router'

jest.mock('@/provision/flow', () => ({cancelProvision: () => {}, startProvision: () => {}}))
jest.mock('@/constants', () => ({...jest.requireActual('@/constants'), androidIsTestDevice: true}))

type BeforeRemoveEvent = {data: {action: {type: string}}; preventDefault: () => void}
// The screen's beforeRemove listeners, as the navigator would call them on a removal
const mockBeforeRemove = new Set<(e: BeforeRemoveEvent) => void>()
// A back of the visible screen: its beforeRemove listeners first, then the pop unless one prevented it
const mockNavigateUp = () => {
  const preventDefault = jest.fn()
  ;[...mockBeforeRemove].forEach(cb => cb({data: {action: {type: 'GO_BACK'}}, preventDefault}))
  if (!preventDefault.mock.calls.length) {
    navigateUp()
  }
}
jest.mock('@/util/safe-navigation', () => ({
  useSafeNavigation: () => ({safeNavigateAppend: () => {}, safeNavigateUp: () => mockNavigateUp()}),
}))
jest.mock('@/signup/common', () => {
  const React = require('react')
  return {
    SignupScreen: ({buttons, children}: {buttons: Array<{label: string; onClick: () => void}>; children?: React.ReactNode}) =>
      React.createElement(
        'div',
        null,
        children,
        buttons.map(b => React.createElement('button', {key: b.label, onClick: b.onClick, type: 'button'}, b.label))
      ),
    errorBanner: () => [],
  }
})
jest.mock('../common', () => ({QuestionBody: () => null}))

import PromptResetPassword from './prompt-reset-password'
import {isRecoverPasswordPromptOpen, startRecoverPassword} from './flow'

const recover = 'keybase.1.login.recoverPassphrase'
const inputCanceled = {code: T.RPCGen.StatusCode.scinputcanceled, desc: 'Input canceled'}
const navigation = {
  addListener: (type: string, cb: (e: BeforeRemoveEvent) => void) => {
    if (type !== 'beforeRemove') return () => {}
    mockBeforeRemove.add(cb)
    return () => mockBeforeRemove.delete(cb)
  },
}

let nav: FakeNavigator

beforeEach(() => {
  mockBeforeRemove.clear()
  nav = installFakeNavigator({rootState: makeRootState({loggedIn: false})})
})

afterEach(() => {
  cleanup()
  restoreNavigator()
  resetAllStores()
})

const settle = async () => {
  await new Promise(resolve => setTimeout(resolve, 0))
  await tick()
}

test("on an Android test device, Continue declines the reset prompt and goes back, without starting over", async () => {
  const fake = installFakeEngine()
  const held = fake.hold(recover)
  startRecoverPassword({username: 'testuser'})
  await tick()
  const sessionID = fake.calls[0]!.params.sessionID as number
  const answered = fake.push(
    'keybase.1.loginUi.promptResetAccount',
    {prompt: {t: T.RPCGen.ResetPromptType.enterResetPw}},
    {sessionID}
  )
  await settle()
  const pushed = nav.navigations().at(-1)
  expect(pushed?.name).toBe('recoverPasswordPromptResetPassword')
  const {promptId} = pushed?.params as {promptId: number}
  const route = makeFakeRoute('recoverPasswordPromptResetPassword')
  route.enter({promptId, username: 'testuser'})
  render(
    <route.Route>
      <NavigationContext value={navigation as never}>
        <PromptResetPassword route={{params: {promptId, username: 'testuser'}}} />
      </NavigationContext>
    </route.Route>
  )
  nav.clearActions()

  act(() => {
    fireEvent.click(screen.getByText('Send a link'))
  })

  await expect(answered).resolves.toEqual({error: inputCanceled})
  expect(isRecoverPasswordPromptOpen(promptId)).toBe(false)
  expect(fake.calls.filter(c => c.method === recover)).toHaveLength(1)
  expect(nav.types()).toEqual(['GO_BACK'])
  held[0]!.reply(undefined)
  await settle()
})
