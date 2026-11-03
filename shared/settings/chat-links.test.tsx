/** @jest-environment jsdom */
/// <reference types="jest" />
import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react'
import * as T from '@/constants/types'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {flush} from '@/test/flush'
import {Links} from './chat'

type Saved = {blocklist?: ReadonlyArray<string> | null; mode: T.RPCChat.UnfurlMode; whitelist?: ReadonlyArray<string> | null}

const getRpc = 'chat.1.local.getUnfurlSettings'
const saveRpc = 'chat.1.local.saveUnfurlSettings'
const normalizeRpc = 'chat.1.local.normalizeUnfurlDomain'

// The service: settings it stores and hands back, and its NormalizeDomain (a url or www. host is its
// bare domain; anything without a dot is refused). Saves are held so a test decides when they land.
const serve = (fake: FakeEngine, initial: Saved) => {
  let stored: Saved = initial
  fake.answer(getRpc, () => stored)
  fake.answer(normalizeRpc, (p: {input: string}) => {
    const domain = p.input
      .trim()
      .toLowerCase()
      .replace(/^[a-z]+:\/\//, '')
      .replace(/^www\./, '')
      .replace(/[/:].*$/, '')
    return domain.includes('.') ? domain : fakeError(T.RPCGen.StatusCode.scgeneric, `invalid domain "${p.input}"`)
  })
  const saves = fake.hold(saveRpc)
  const accept = async (i: number) => {
    const held: {params: Saved; reply: (a: unknown) => void} = saves[i]!
    const {params, reply} = held
    stored = {blocklist: params.blocklist, mode: params.mode, whitelist: params.whitelist}
    reply(null)
    await flush()
  }
  return {accept, saves}
}

const modeIDs = {
  [T.RPCChat.UnfurlMode.always]: 'always',
  [T.RPCChat.UnfurlMode.never]: 'never',
  [T.RPCChat.UnfurlMode.whitelisted]: 'whitelisted',
} as const
// the radio's testID carries its state: -on, -off, or -pending while the settings cannot be edited
const modeState = (mode: T.RPCChat.UnfurlMode) => {
  const el: unknown = screen.getByTestId(new RegExp(`^${TestIDs.SETTINGS_UNFURL_MODE_PREFIX}${modeIDs[mode]}-`))
  // the native tsconfig has no DOM lib
  const id = (el as {getAttribute: (n: string) => string | null}).getAttribute('data-testid') ?? ''
  return id.split('-').at(-1)
}
const classOf = (el: unknown) => (el as {className: string}).className
const isDisabled = (button: unknown) => classOf(button).includes('button--disabled')
const parentOf = (el: unknown) => (el as {parentElement: unknown}).parentElement
const saveButton = () => screen.getByTestId(TestIDs.SETTINGS_UNFURL_SAVE)
const blockInput = () => screen.getAllByPlaceholderText('Add a website, e.g. example.com')[1]!

beforeEach(() => {
  useConfigState.setState({loggedIn: true})
})

afterEach(() => {
  cleanup()
  resetAllStores()
})

const renderLoaded = async (initial: Saved) => {
  const fake = installFakeEngine()
  const service = serve(fake, initial)
  render(<Links />)
  // the settings load on mount, so nothing shows as chosen until the service answers
  await flush()
  expect(modeState(initial.mode)).toBe('on')
  return {fake, ...service}
}

const addToBlocklist = async (input: string) => {
  fireEvent.change(blockInput(), {target: {value: input}})
  fireEvent.keyDown(blockInput(), {key: 'Enter'})
  await flush()
}

const selectAskAndBlock = async (domain: string) => {
  fireEvent.click(screen.getByText('Ask per domain'))
  await addToBlocklist(domain)
}

const save = async () => {
  fireEvent.click(saveButton())
  await flush()
}

test('the settings load once on mount', async () => {
  const {fake} = await renderLoaded({mode: T.RPCChat.UnfurlMode.never})
  expect(fake.calls.map(c => c.method)).toEqual([getRpc])
})

test('a rejected save keeps the chosen mode and pending edits', async () => {
  const {fake, saves} = await renderLoaded({mode: T.RPCChat.UnfurlMode.always})
  await selectAskAndBlock('foo.com')
  expect(screen.getByText('foo.com')).toBeTruthy()

  await save()
  expect(saves).toHaveLength(1)
  expect(saves[0]!.params).toEqual(
    expect.objectContaining({blocklist: ['foo.com'], mode: T.RPCChat.UnfurlMode.whitelisted, whitelist: []})
  )
  saves[0]!.reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'bad domain'))
  await flush()

  expect(screen.getByText(/Unable to save link preview settings: bad domain/)).toBeTruthy()
  expect(modeState(T.RPCChat.UnfurlMode.whitelisted)).toBe('on')
  expect(screen.getByText('foo.com')).toBeTruthy()
  expect(fake.calls.filter(c => c.method === getRpc)).toHaveLength(1)
})

test('a successful save shows the saved settings', async () => {
  const {accept, fake} = await renderLoaded({mode: T.RPCChat.UnfurlMode.always})
  await selectAskAndBlock('foo.com')
  await save()
  await accept(0)

  // the save is followed by a refresh that brings back what the service stored
  expect(fake.calls.filter(c => c.method === getRpc)).toHaveLength(2)
  expect(isDisabled(saveButton())).toBe(true)
  expect(modeState(T.RPCChat.UnfurlMode.whitelisted)).toBe('on')
  expect(screen.getByText('foo.com')).toBeTruthy()
})

test('list edits are disabled while a save is in flight', async () => {
  const {accept, saves} = await renderLoaded({mode: T.RPCChat.UnfurlMode.whitelisted})
  await addToBlocklist('bar.com')
  await save()
  expect(saves).toHaveLength(1)
  // the engine throttles a call's waiting increment, so the screen hears of the save a little later
  await waitFor(() => expect(modeState(T.RPCChat.UnfurlMode.never)).toBe('pending'), {timeout: 1000})

  await addToBlocklist('foo.com')
  expect(screen.queryByText('foo.com')).toBeNull()
  for (const add of screen.getAllByText('Add')) {
    expect(isDisabled(parentOf(add))).toBe(true)
  }
  expect(modeState(T.RPCChat.UnfurlMode.never)).toBe('pending')

  await accept(0)
  expect(modeState(T.RPCChat.UnfurlMode.never)).toBe('off')
})

test('a typed url is added as its domain, so it matches the saved row', async () => {
  const {saves} = await renderLoaded({mode: T.RPCChat.UnfurlMode.whitelisted, whitelist: ['yahoo.com']})
  await addToBlocklist('https://www.Yahoo.com/news')

  expect(screen.getAllByText('yahoo.com')).toHaveLength(1)
  expect((blockInput() as unknown as {value: string}).value).toBe('')
  await save()
  expect(saves[0]!.params).toEqual(
    expect.objectContaining({blocklist: ['yahoo.com'], mode: T.RPCChat.UnfurlMode.whitelisted, whitelist: []})
  )
})

test('input that cannot be listed shows the error and stays in the box', async () => {
  await renderLoaded({mode: T.RPCChat.UnfurlMode.whitelisted})
  await addToBlocklist('nodots')

  expect(screen.getByText('invalid domain "nodots"')).toBeTruthy()
  expect((blockInput() as unknown as {value: string}).value).toBe('nodots')
  expect(isDisabled(saveButton())).toBe(true)
  expect(isDisabled(parentOf(screen.getAllByText('Add')[1]))).toBe(false)
})

// The engine throttles a call's waiting increment, so for a moment after Save the lists are still
// editable; an edit made then must outlive the save's success rather than be cleared with it.
test('an edit made before the save is known to be in flight is kept when the save succeeds', async () => {
  const {accept, saves} = await renderLoaded({mode: T.RPCChat.UnfurlMode.whitelisted})
  await addToBlocklist('bar.com')
  await save()
  expect(saves).toHaveLength(1)
  await addToBlocklist('foo.com')
  expect(screen.getByText('foo.com')).toBeTruthy()

  await accept(0)

  expect(screen.getByText('bar.com')).toBeTruthy()
  expect(screen.getByText('foo.com')).toBeTruthy()
  expect(isDisabled(saveButton())).toBe(false)
})
