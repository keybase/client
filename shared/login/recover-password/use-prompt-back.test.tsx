/** @jest-environment jsdom */
/// <reference types="jest" />
import * as React from 'react'
import * as T from '@/constants/types'
import {act, cleanup, render} from '@testing-library/react'
import {NavigationContext} from '@react-navigation/core'
import {resetAllStores} from '@/util/zustand'
import {installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {tick} from '@/test/flush'
import {installFakeNavigator, makeRootState, restoreNavigator, type FakeNavigator} from '@/test/fake-navigator'

jest.mock('@/provision/flow', () => ({cancelProvision: () => {}, startProvision: () => {}}))

import {
  cancelRecoverPassword,
  isRecoverPasswordPromptOpen,
  startRecoverPassword,
  submitRecoverPasswordDeviceSelect,
} from './flow'
import {useRecoverPromptBack} from './use-prompt-back'

const recover = 'keybase.1.login.recoverPassphrase'
const inputCanceled = {code: T.RPCGen.StatusCode.scinputcanceled, desc: 'Input canceled'}

type BeforeRemoveEvent = {data: {action: {type: string}}; preventDefault: () => void}

let nav: FakeNavigator
let fake: FakeEngine
// The screen's route: its beforeRemove listeners, as the navigator would call them on removal. Each add
// is its own entry, so a listener added twice shows even where both adds pass the same function.
let beforeRemove: Set<{cb: (e: BeforeRemoveEvent) => void}>
const navigation = {
  addListener: (type: string, cb: (e: BeforeRemoveEvent) => void) => {
    if (type !== 'beforeRemove') return () => {}
    const entry = {cb}
    beforeRemove.add(entry)
    return () => beforeRemove.delete(entry)
  },
}

beforeEach(() => {
  beforeRemove = new Set()
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

// `hidden` hides the screen the way native-stack does under other screens: its effects are torn down
type OnRouteProps = {hidden?: boolean; onBack?: () => void; promptId: number}
const OnRoute = ({hidden = false, onBack, promptId}: OnRouteProps) => (
  <NavigationContext value={navigation as never}>
    <React.Activity mode={hidden ? 'hidden' : 'visible'}>
      <Screen onBack={onBack} promptId={promptId} />
    </React.Activity>
  </NavigationContext>
)

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
  const back = onBack ? () => onBack(promptId) : undefined
  // StrictMode renders twice and mounts the screen's effects, unmounts them and mounts them again
  const view = render(<OnRoute onBack={back} promptId={promptId} />, {reactStrictMode: true})
  // One listener for the route, however often the screen rendered
  expect(beforeRemove.size).toBe(1)
  const setHidden = async (hidden: boolean) => {
    view.rerender(<OnRoute hidden={hidden} onBack={back} promptId={promptId} />)
    await settle()
  }
  return {answered, held, promptId, setHidden}
}

// The screen is about to be removed by `type`; returns whether the removal was prevented
const remove = (type: string) => {
  const preventDefault = jest.fn()
  act(() => [...beforeRemove].forEach(({cb}) => cb({data: {action: {type}}, preventDefault})))
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

test('a screen removed while hidden refuses its prompt', async () => {
  const onBack = jest.fn()
  const {answered, held, setHidden} = await setup(onBack)
  await setHidden(true)

  expect(remove('REMOVE')).toBe(false)

  await expect(answered).resolves.toEqual({error: inputCanceled})
  expect(onBack).not.toHaveBeenCalled()
  held[0]!.reply(undefined)
  await settle()
})

test("a screen hidden and shown again runs its back once on a back", async () => {
  const onBack = jest.fn((promptId: number) => cancelRecoverPassword(promptId))
  const {answered, held, setHidden} = await setup(onBack)
  await setHidden(true)
  await setHidden(false)
  expect(beforeRemove.size).toBe(1)

  expect(remove('GO_BACK')).toBe(true)

  await expect(answered).resolves.toEqual({error: inputCanceled})
  expect(onBack).toHaveBeenCalledTimes(1)
  expect(nav.types()).toEqual(['GO_BACK'])
  held[0]!.reply(undefined)
  await settle()
})

test('an answered prompt is not refused when its screen goes, and its listener goes with the prompt', async () => {
  const onBack = jest.fn()
  const {answered, held, promptId} = await setup(onBack)
  act(() => submitRecoverPasswordDeviceSelect(promptId, 'device1' as T.Devices.DeviceID))
  await expect(answered).resolves.toEqual({result: 'device1'})
  await settle()
  expect(beforeRemove.size).toBe(0)

  expect(remove('GO_BACK')).toBe(false)
  expect(onBack).not.toHaveBeenCalled()
  held[0]!.reply(undefined)
  await settle()
})
