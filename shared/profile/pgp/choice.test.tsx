/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'
import * as T from '@/constants/types'
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {installFakeNavigator, makeRootState, restoreNavigator, type FakeNavigator} from '@/test/fake-navigator'
import {flush, tick} from '@/test/flush'
import {RPCError} from '@/util/errors'
import Choice, {generatePgp, validatePgpInfo} from './choice'

// The real components need electron rendering; only the text, inputs and buttons matter here.
jest.mock('@/common-adapters', () => {
  const React = require('react')
  const passThrough = ({children}: {children?: React.ReactNode}) =>
    React.createElement('div', null, children)
  return {
    Animation: () => null,
    Box2: passThrough,
    Button: ({label, onClick}: {label?: string; onClick?: () => void}) =>
      React.createElement('button', {onClick, type: 'button'}, label),
    Checkbox: ({checked, label, onCheck}: {checked: boolean; label: string; onCheck: (c: boolean) => void}) =>
      React.createElement('button', {onClick: () => onCheck(!checked), type: 'button'}, label),
    IconAuto: () => null,
    Input3: ({onChangeText, placeholder, value}: {onChangeText: (t: string) => void; placeholder: string; value: string}) =>
      React.createElement('input', {onChange: (e: {target: {value: string}}) => onChangeText(e.target.value), placeholder, value}),
    ListItem: ({body, onClick}: {body: React.ReactNode; onClick: () => void}) =>
      React.createElement('div', {onClick}, body),
    ScrollView: passThrough,
    Styles: {
      castStyleDesktop: (s: unknown) => s,
      createStyleHook: () => () => ({}),
      globalMargins: {},
      globalStyles: {},
      platformStyles: () => ({}),
    },
    Text: passThrough,
  }
})
jest.mock('@/profile/platform-icon', () => () => null)

const pgpRpc = 'keybase.1.pgp.pgpKeyGenDefault'
const keyGenerated = 'keybase.1.pgpUi.keyGenerated'
const pushPrivate = 'keybase.1.pgpUi.shouldPushPrivate'
const inputCanceled = {code: T.RPCGen.StatusCode.scinputcanceled, desc: 'Input canceled'}
const publicKey = '-----BEGIN PGP PUBLIC KEY BLOCK-----'

const makeInfo = (overrides?: Partial<Parameters<typeof validatePgpInfo>[0]>) => ({
  pgpEmail1: 'testuser@example.com',
  pgpEmail2: '',
  pgpEmail3: '',
  pgpFullName: 'Test User',
  ...overrides,
})

// The listener hands incoming calls to their handlers on a timer, then React commits the step
const settle = async () => {
  await act(async () => new Promise(resolve => setTimeout(resolve, 0)))
  await flush()
}

const pushKey = async (fake: FakeEngine, sessionID: number) =>
  fake.push(keyGenerated, {key: {key: publicKey}, kid: 'kid'}, {sessionID})

describe('the generate flow', () => {
  let nav: FakeNavigator

  beforeEach(() => {
    nav = installFakeNavigator({
      modalRouteNames: ['profilePgp'],
      rootState: makeRootState({above: [{name: 'profilePgp'}]}),
    })
  })

  afterEach(() => {
    cleanup()
    restoreNavigator()
  })

  // Renders the screen and walks it to the generate step; the service holds the RPC
  const startGenerating = async (onEngineIncoming?: () => void) => {
    const fake = installFakeEngine({onEngineIncoming})
    const held = fake.hold(pgpRpc)
    render(<Choice />)
    fireEvent.click(screen.getByText('Get a new PGP key'))
    fireEvent.change(screen.getByPlaceholderText('Your full name'), {target: {value: 'Test User'}})
    fireEvent.change(screen.getByPlaceholderText('Email 1'), {target: {value: 'testuser@example.com'}})
    fireEvent.click(screen.getByText('Let the math begin'))
    await flush()
    expect(screen.getByText('Generating your unique key...')).toBeTruthy()
    const sessionID = fake.calls[0]!.params.sessionID as number
    return {fake, held, sessionID}
  }

  test('generating sends the uids from the form', async () => {
    const {fake} = await startGenerating()
    expect(fake.calls[0]!.method).toBe(pgpRpc)
    expect(fake.calls[0]!.params.createUids).toEqual({
      ids: [{comment: '', email: 'testuser@example.com', username: 'Test User'}],
      useDefault: false,
    })
  })

  test.each([false, true])(
    'the key is recorded and acked, then Done answers whether to store it on the server (%s)',
    async store => {
      const {fake, held, sessionID} = await startGenerating()
      await expect(pushKey(fake, sessionID)).resolves.toEqual({result: undefined})
      const pushed = fake.push(pushPrivate, {prompt: true}, {sessionID})
      await settle()
      expect(screen.getByText('Here is your unique public key!')).toBeTruthy()
      expect(screen.getByDisplayValue(publicKey)).toBeTruthy()
      if (store) {
        fireEvent.click(screen.getByText("Store encrypted private key on Keybase's server"))
      }
      fireEvent.click(screen.getByText(store ? 'Done, post to Keybase' : 'Done'))
      await expect(pushed).resolves.toEqual({result: store})
      expect(nav.modalsCleared()).toBe(true)
      held[0]!.reply(undefined)
      await flush()
    }
  )

  test('the finished step offers to store the key only when the service asks', async () => {
    const {fake, held, sessionID} = await startGenerating()
    await pushKey(fake, sessionID)
    const pushed = fake.push(pushPrivate, {prompt: false}, {sessionID})
    await settle()
    expect(screen.queryByText("Store encrypted private key on Keybase's server")).toBeNull()
    fireEvent.click(screen.getByText('Done'))
    await expect(pushed).resolves.toEqual({result: false})
    held[0]!.reply(undefined)
  })

  test('unmounting before the key is generated refuses it, without reaching a global answerer', async () => {
    const onEngineIncoming = jest.fn()
    const {fake, held, sessionID} = await startGenerating(onEngineIncoming)
    cleanup()
    await expect(pushKey(fake, sessionID)).resolves.toEqual({error: inputCanceled})
    await expect(fake.push(pushPrivate, {prompt: true}, {sessionID})).resolves.toEqual({error: inputCanceled})
    expect(onEngineIncoming).not.toHaveBeenCalled()
    held[0]!.reply(undefined)
  })

  test('unmounting at the finished step refuses the store-on-server prompt', async () => {
    const {fake, held, sessionID} = await startGenerating()
    await pushKey(fake, sessionID)
    const pushed = fake.push(pushPrivate, {prompt: true}, {sessionID})
    await settle()
    expect(screen.getByText('Here is your unique public key!')).toBeTruthy()
    cleanup()
    await expect(pushed).resolves.toEqual({error: inputCanceled})
    held[0]!.reply(undefined)
  })

  test('cancel while generating clears the modals and refuses the key', async () => {
    const {fake, held, sessionID} = await startGenerating()
    fireEvent.click(screen.getByText('Cancel'))
    expect(nav.modalsCleared()).toBe(true)
    await expect(pushKey(fake, sessionID)).resolves.toEqual({error: inputCanceled})
    held[0]!.reply(undefined)
  })

  test('cancel at the info step goes back to the choice without starting anything', async () => {
    const fake = installFakeEngine()
    render(<Choice />)
    fireEvent.click(screen.getByText('Get a new PGP key'))
    fireEvent.click(screen.getByText('Cancel'))
    await flush()
    expect(screen.getByText('I have one already')).toBeTruthy()
    expect(nav.modalsCleared()).toBe(false)
    expect(fake.calls).toEqual([])
  })
})

describe('generatePgp', () => {
  test('a dispose ends the run at once, without waiting for the service', async () => {
    const fake = installFakeEngine()
    const held = fake.hold(pgpRpc)
    const onFinished = jest.fn()
    const {dialog, finished} = generatePgp(makeInfo(), onFinished)
    await tick()
    let ended = false
    void finished.then(() => {
      ended = true
    })
    dialog.dispose()
    await tick()
    expect(ended).toBe(true)
    expect(onFinished).not.toHaveBeenCalled()
    held[0]!.reply(undefined)
  })

  test('a non-cancel RPC error is rethrown', async () => {
    const fake = installFakeEngine()
    const held = fake.hold(pgpRpc)
    const {finished} = generatePgp(makeInfo(), () => {})
    await tick()
    held[0]!.reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'boom'))
    const error: unknown = await finished.then(
      () => undefined,
      (e: unknown) => e
    )
    expect(error).toBeInstanceOf(RPCError)
    expect((error as RPCError).code).toBe(T.RPCGen.StatusCode.scgeneric)
  })

  test('an input-canceled error from the service ends the run quietly', async () => {
    const fake = installFakeEngine()
    const held = fake.hold(pgpRpc)
    const {finished} = generatePgp(makeInfo(), () => {})
    await tick()
    held[0]!.reply(fakeError(T.RPCGen.StatusCode.scinputcanceled, 'Input canceled'))
    await expect(finished).resolves.toBeUndefined()
  })

  test('a password prompt while storing the key on the server is left to the global answerer', async () => {
    const fake = installFakeEngine()
    const held = fake.hold(pgpRpc)
    const {finished} = generatePgp(makeInfo(), () => {})
    await tick()
    const sessionID = fake.calls[0]!.params.sessionID as number
    // No answerer is registered here, so the global path refuses it; the point is that it gets there
    // without being reported as an undeclared fall-through
    await fake.push('keybase.1.secretUi.getPassphrase', {pinentry: {type: 0}}, {sessionID})
    held[0]!.reply(undefined)
    await finished
  })
})

test('validatePgpInfo accepts a name plus a single email', () => {
  expect(validatePgpInfo(makeInfo())).toEqual({
    pgpErrorEmail1: false,
    pgpErrorEmail2: false,
    pgpErrorEmail3: false,
    pgpErrorText: '',
  })
})

test('validatePgpInfo treats the optional emails as valid while they are empty', () => {
  const res = validatePgpInfo(makeInfo({pgpEmail2: '', pgpEmail3: ''}))
  expect(res.pgpErrorEmail2).toBe(false)
  expect(res.pgpErrorEmail3).toBe(false)
  expect(res.pgpErrorText).toBe('')
})

test('validatePgpInfo requires the first email even though 2 and 3 are optional', () => {
  const res = validatePgpInfo(makeInfo({pgpEmail1: ''}))
  expect(res.pgpErrorEmail1).toBe(true)
  expect(res.pgpErrorText).toBe('Empty email address.')
})

test('validatePgpInfo reports a missing name ahead of any email problem', () => {
  const res = validatePgpInfo(makeInfo({pgpEmail1: 'nope', pgpFullName: '   '}))
  expect(res.pgpErrorEmail1).toBe(true)
  expect(res.pgpErrorText).toBe('Please provide your name.')
})

test('validatePgpInfo flags each optional email independently once it is filled in', () => {
  const res = validatePgpInfo(makeInfo({pgpEmail2: 'not-an-email', pgpEmail3: 'three@example.com'}))
  expect(res).toEqual({
    pgpErrorEmail1: false,
    pgpErrorEmail2: true,
    pgpErrorEmail3: false,
    pgpErrorText: 'Invalid email address.',
  })
})

test('validatePgpInfo rejects emails with spaces', () => {
  const res = validatePgpInfo(makeInfo({pgpEmail1: 'test user@example.com'}))
  expect(res.pgpErrorEmail1).toBe(true)
  expect(res.pgpErrorText).toBe('Invalid email address.')
})
