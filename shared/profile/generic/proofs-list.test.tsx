/** @jest-environment jsdom */
/// <reference types="jest" />
import * as React from 'react'
import * as T from '@/constants/types'
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
import {installFakeEngine} from '@/test/fake-engine'
import {installFakeNavigator, makeRootState, restoreNavigator, type FakeNavigator} from '@/test/fake-navigator'
import {flush} from '@/test/flush'
import {makeFakeRoute} from '@/test/fake-route'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import ProofsList from './proofs-list'

// The real components need electron rendering; only the text, inputs and buttons matter here.
jest.mock('@/common-adapters', () => {
  const React = require('react')
  const passThrough = ({children}: {children?: React.ReactNode}) => React.createElement('div', null, children)
  const button = ({label, onClick}: {label?: string; onClick?: () => void}) =>
    React.createElement('button', {onClick, type: 'button'}, label)
  // Any style lookup, at any depth, gives something usable
  const anyStyle: unknown = new Proxy(() => anyStyle, {get: () => anyStyle})
  return {
    Box2: passThrough,
    Button: button,
    ConfirmButtons: ({confirmLabel, onCancel, onConfirm}: {confirmLabel: string; onCancel: () => void; onConfirm: () => void}) =>
      React.createElement('div', null, button({label: 'Cancel', onClick: onCancel}), button({label: confirmLabel, onClick: onConfirm})),
    CopyableText: ({value}: {value: string}) => React.createElement('div', null, value),
    IconAuto: () => null,
    Input3: ({onChangeText, value}: {onChangeText: (t: string) => void; value: string}) =>
      React.createElement('input', {onChange: (e: {target: {value: string}}) => onChangeText(e.target.value), value}),
    ProgressIndicator: () => null,
    ScrollView: passThrough,
    Styles: anyStyle,
    Text: passThrough,
    WaitingButton: button,
    useClickURL: () => ({}),
  }
})
jest.mock('react-native', () => ({...jest.requireActual<object>('react-native'), useColorScheme: () => 'light'}))
jest.mock('@/profile/platform-icon', () => () => null)
jest.mock('./site-icon', () => ({SiteIcon: () => null}))
jest.mock('../use-proof-suggestions', () => ({useProofSuggestions: () => ({proofSuggestions: []})}))
jest.mock('@/tracker/use-profile', () => ({useTrackerProfile: () => ({loadProfile: () => {}})}))

const startProof = 'keybase.1.prove.startProof'
const promptUsername = 'keybase.1.proveUi.promptUsername'
const outputInstructions = 'keybase.1.proveUi.outputInstructions'
const checking = 'keybase.1.proveUi.checking'
const inputCanceled = {code: T.RPCGen.StatusCode.scinputcanceled, desc: 'Input canceled'}
const instructions = {data: 'host this', markup: false}

// The listener hands incoming calls to their handlers on a timer, then React commits the step
const settle = async () => {
  await act(async () => new Promise(resolve => setTimeout(resolve, 0)))
  await flush()
}

let route: ReturnType<typeof makeFakeRoute>

// `hidden` hides the screen the way native-stack does under other screens: its effects are torn down
const OnRoute = ({hidden = false, platform}: {hidden?: boolean; platform: string}) => (
  <route.Route>
    <React.Activity mode={hidden ? 'hidden' : 'visible'}>
      <ProofsList platform={platform} />
    </React.Activity>
  </route.Route>
)

describe('the proofs screen', () => {
  let nav: FakeNavigator

  beforeEach(() => {
    route = makeFakeRoute('profileProofsList')
    route.enter()
    nav = installFakeNavigator({
      modalRouteNames: ['profileProofsList'],
      rootState: makeRootState({above: [{name: 'profileProofsList'}]}),
    })
  })

  afterEach(() => {
    cleanup()
    restoreNavigator()
    resetAllStores()
  })

  // Opens the screen on a website proof and answers its username prompt; the service holds the RPC
  const startWebsiteProof = async () => {
    const fake = installFakeEngine()
    const held = fake.hold(startProof)
    // StrictMode mounts the screen's effects, unmounts them and mounts them again
    const view = render(<OnRoute platform="https" />, {reactStrictMode: true})
    await flush()
    // StrictMode's remount neither ended nor restarted the flow
    expect(fake.calls).toHaveLength(1)
    const sessionID = fake.calls[0]!.params.sessionID as number
    const answered = fake.push(promptUsername, {prompt: 'Your website'}, {sessionID})
    await settle()
    fireEvent.change(screen.getByRole('textbox'), {target: {value: 'https://example.com/keybase.txt'}})
    fireEvent.click(screen.getByText('Continue'))
    await expect(answered).resolves.toEqual({result: 'example.com'})
    const instructed = fake.push(outputInstructions, {instructions, proof: 'proof text'}, {sessionID})
    await settle()
    expect(screen.getByText('proof text')).toBeTruthy()
    return {fake, held, instructed, sessionID, view}
  }

  test('Continue answers the username, and the posted button answers the instructions', async () => {
    const {held, instructed} = await startWebsiteProof()
    fireEvent.click(screen.getByText('OK posted! Check for it!'))
    await expect(instructed).resolves.toEqual({result: undefined})
    held[0]!.reply(undefined)
    await settle()
  })

  test('Cancel mid server work goes back and refuses the next prompt', async () => {
    const {fake, held, instructed, sessionID} = await startWebsiteProof()
    fireEvent.click(screen.getByText('OK posted! Check for it!'))
    await instructed
    fireEvent.click(screen.getByText('Cancel'))
    expect(nav.types()).toEqual(['GO_BACK'])
    await expect(fake.push(checking, {name: 'https'}, {sessionID})).resolves.toEqual({error: inputCanceled})
    held[0]!.reply(undefined)
    await settle()
  })

  test('leaving the screen refuses the open instructions', async () => {
    const {held, instructed} = await startWebsiteProof()
    route.leave()
    await expect(instructed).resolves.toEqual({error: inputCanceled})
    held[0]!.reply(undefined)
    await settle()
  })

  test('a screen hidden and shown again keeps its flow, and leaving it after still ends the flow', async () => {
    const {fake, held, instructed, view} = await startWebsiteProof()
    view.rerender(<OnRoute hidden={true} platform="https" />)
    await settle()
    view.rerender(<OnRoute platform="https" />)
    await settle()
    expect(fake.calls).toHaveLength(1)
    expect(screen.getByText('proof text')).toBeTruthy()
    fireEvent.click(screen.getByText('OK posted! Check for it!'))
    await expect(instructed).resolves.toEqual({result: undefined})
    held[0]!.reply(undefined)
    await settle()
  })

  test('removing a hidden screen ends its flow', async () => {
    const {held, instructed, view} = await startWebsiteProof()
    view.rerender(<OnRoute hidden={true} platform="https" />)
    await settle()
    route.leave()
    await expect(instructed).resolves.toEqual({error: inputCanceled})
    held[0]!.reply(undefined)
    await settle()
  })

  test('a removal that is prevented leaves the route in the state, and keeps the flow', async () => {
    const {held, instructed} = await startWebsiteProof()
    route.enter()
    fireEvent.click(screen.getByText('OK posted! Check for it!'))
    await expect(instructed).resolves.toEqual({result: undefined})
    held[0]!.reply(undefined)
    await settle()
  })

  test.each([
    ['before', true],
    ['after', false],
  ])('a logout swapping the screen out %s its root ends the flow once', async (_, leaveFirst) => {
    useConfigState.getState().dispatch.setLoggedIn(true)
    const {fake, held, instructed, sessionID} = await startWebsiteProof()
    if (leaveFirst) route.leave()
    act(() => useConfigState.getState().dispatch.setLoggedIn(false))
    if (!leaveFirst) route.leave()

    await expect(instructed).resolves.toEqual({error: inputCanceled})
    await expect(fake.push(checking, {name: 'https'}, {sessionID})).resolves.toEqual({error: inputCanceled})
    held[0]!.reply(undefined)
    await settle()
  })
})
