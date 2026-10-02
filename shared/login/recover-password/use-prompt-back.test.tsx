/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {act, cleanup, render} from '@testing-library/react'
import {NavigationContext} from '@react-navigation/core'
import {resetAllStores} from '@/util/zustand'
import {installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {tick} from '@/test/flush'
import {installFakeNavigator, makeRootState, restoreNavigator, type FakeNavigator} from '@/test/fake-navigator'

jest.mock('@/provision/flow', () => ({cancelProvision: () => {}, startProvision: () => {}}))

import {cancelRecoverPassword, isRecoverPasswordPromptOpen, startRecoverPassword} from './flow'
import {useRecoverPromptBack} from './use-prompt-back'

const recover = 'keybase.1.login.recoverPassphrase'
const inputCanceled = {code: T.RPCGen.StatusCode.scinputcanceled, desc: 'Input canceled'}

type BeforeRemoveEvent = {data: {action: {type: string}}; preventDefault: () => void}

let nav: FakeNavigator
let fake: FakeEngine
let beforeRemove: undefined | ((e: BeforeRemoveEvent) => void)

beforeEach(() => {
  beforeRemove = undefined
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

const Screen = ({onBack, promptId}: {onBack?: () => void; promptId: number}) => {
  useRecoverPromptBack(promptId, onBack)
  return null
}

// Starts a run, has Go show the device selector, and mounts a screen for its prompt
const setup = async (onBack?: (promptId: number) => void) => {
  fake = installFakeEngine()
  const held = fake.hold(recover)
  startRecoverPassword({username: 'testuser'})
  await tick()
  const sessionID = fake.calls[0]!.params.sessionID as number
  const answered = fake.push(
    'keybase.1.loginUi.chooseDeviceToRecoverWith',
    {devices: [], username: 'testuser'},
    {sessionID}
  )
  await settle()
  const promptId = (nav.navigations().at(-1)?.params as {promptId: number}).promptId
  nav.clearActions()
  const navigation = {
    addListener: (type: string, cb: (e: BeforeRemoveEvent) => void) => {
      if (type === 'beforeRemove') beforeRemove = cb
      return () => {}
    },
  }
  render(
    <NavigationContext value={navigation as never}>
      <Screen onBack={onBack ? () => onBack(promptId) : undefined} promptId={promptId} />
    </NavigationContext>
  )
  return {answered, held, promptId}
}

// The screen is about to be removed by `type`; returns whether the removal was prevented
const remove = (type: string) => {
  const preventDefault = jest.fn()
  act(() => beforeRemove?.({data: {action: {type}}, preventDefault}))
  return preventDefault.mock.calls.length > 0
}

test.each(['GO_BACK', 'POP'])(
  "a back (%s) runs the screen's back in its place, which navigates once and is let through",
  async type => {
    const {answered, held} = await setup(cancelRecoverPassword)

    expect(remove(type)).toBe(true)
    await expect(answered).resolves.toEqual({error: inputCanceled})
    expect(nav.types()).toEqual(['GO_BACK'])
    // The flow's own pop comes next, with the prompt closed
    expect(remove('GO_BACK')).toBe(false)
    expect(nav.types()).toEqual(['GO_BACK'])
    held[0]!.reply(undefined)
    await settle()
  }
)

test('a back running a restart refuses the prompt and starts a new run', async () => {
  const {answered, held} = await setup(() => startRecoverPassword({replaceRoute: true, username: 'testuser'}))

  expect(remove('GO_BACK')).toBe(true)

  await expect(answered).resolves.toEqual({error: inputCanceled})
  expect(fake.calls.filter(c => c.method === recover)).toHaveLength(2)
  expect(nav.types()).toEqual([])
  held[1]!.reply(undefined)
  await settle()
})

test('a native dismissal refuses the prompt without navigating or running the back', async () => {
  const onBack = jest.fn()
  const {answered, held} = await setup(onBack)

  expect(remove('REMOVE')).toBe(false)

  await expect(answered).resolves.toEqual({error: inputCanceled})
  expect(onBack).not.toHaveBeenCalled()
  expect(nav.types()).toEqual([])
  held[0]!.reply(undefined)
  await settle()
})

test('a screen without its own back is let go and its prompt refused', async () => {
  const {answered, held} = await setup()

  expect(remove('POP')).toBe(false)

  await expect(answered).resolves.toEqual({error: inputCanceled})
  held[0]!.reply(undefined)
  await settle()
})

test('an app-initiated reset neither prevents nor answers', async () => {
  const onBack = jest.fn()
  const {held, promptId} = await setup(onBack)

  expect(remove('RESET')).toBe(false)

  expect(onBack).not.toHaveBeenCalled()
  expect(isRecoverPasswordPromptOpen(promptId)).toBe(true)
  held[0]!.reply(undefined)
  await settle()
})

test('a screen whose prompt is closed goes without a back', async () => {
  const onBack = jest.fn()
  const {held} = await setup(onBack)
  held[0]!.reply(undefined)
  await settle()

  expect(remove('GO_BACK')).toBe(false)
  expect(onBack).not.toHaveBeenCalled()
})
