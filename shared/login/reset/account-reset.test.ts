/** @jest-environment jsdom */
/// <reference types="jest" />
import {setImmediate} from 'node:timers'
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {installNavigation, makeRootState, type InstalledNavigation} from '@/test/navigation'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {enterResetPipeline, startAccountReset, submitResetPrompt} from './account-reset'

const pipeline = 'keybase.1.account.enterResetPipeline'
const promptReset = 'keybase.1.loginUi.promptResetAccount'
const resetProgress = 'keybase.1.loginUi.displayResetProgress'

let nav: InstalledNavigation

// The confirm screen is handed a one-shot key, and the only way to learn it is to read
// the params of the screen the flow navigated to.
const lastResetKey = () => (nav.visibleScreen()?.params as {resetKey?: string} | undefined)?.resetKey ?? ''

// The logged-out stack's screens, bottom to top.
const loggedOutStack = () => nav.getRootState()?.routes?.[0]?.state?.routes.map(r => r.name)

// The flow starts from a screen of the logged-out stack, above login.
beforeEach(() => {
  nav = installNavigation({rootState: makeRootState({above: [{name: 'resetEnterPassword'}], loggedIn: false})})
})

afterEach(() => {
  resetAllStores()
})

// What crosses to or from the service arrives a turn later (Electron IPC), then the flow's own timers run
const flush = async () => {
  await new Promise<void>(resolve => setImmediate(resolve))
  await new Promise<void>(resolve => setTimeout(resolve, 0))
  await new Promise<void>(resolve => setImmediate(resolve))
}

// Enters the pipeline against the fake service, which holds the call open, as Go does while it prompts
const enter = async (fake: FakeEngine, onError?: (e: string) => void) => {
  const held = fake.hold(pipeline)
  enterResetPipeline({onError, username: 'testuser'})
  await flush()
  expect(held).toHaveLength(1)
  const sessionID = held[0]!.params.sessionID as number
  return {held, sessionID}
}

const completePrompt = (hasWallet: boolean) => ({
  prompt: {complete: {hasWallet}, t: T.RPCGen.ResetPromptType.complete},
})

test('startAccountReset navigates into the reset flow', () => {
  startAccountReset(true, 'testuser')

  expect(nav.visibleScreen()).toMatchObject({
    name: 'recoverPasswordPromptResetAccount',
    params: {skipPassword: true, username: 'testuser'},
  })
  expect(loggedOutStack()).toEqual(['login', 'recoverPasswordPromptResetAccount'])
})

test('enterResetPipeline exposes a submit handler for the confirm screen and starts provision on confirm', async () => {
  const fake = installFakeEngine()
  const {held, sessionID} = await enter(fake)
  const answered = fake.push(promptReset, completePrompt(true), {sessionID})
  await flush()

  const resetKey = lastResetKey()
  expect(resetKey).not.toBe('')
  expect(nav.visibleScreen()).toMatchObject({name: 'resetConfirm', params: {hasWallet: true, resetKey}})
  expect(loggedOutStack()).toEqual(['login', 'resetConfirm'])

  submitResetPrompt(resetKey, T.RPCGen.ResetPromptResponse.confirmReset)

  expect(await answered).toEqual({result: T.RPCGen.ResetPromptResponse.confirmReset})
  // provisioning starts over for this user, from reset
  expect(nav.visibleScreen()).toMatchObject({name: 'username', params: {fromReset: true, username: 'testuser'}})
  held[0]!.reply(null)
  await flush()
})

test('enterResetPipeline responds and starts the reset flow for non-complete prompts', async () => {
  const fake = installFakeEngine()
  const {held, sessionID} = await enter(fake)

  const answered = await fake.push(promptReset, {prompt: {t: T.RPCGen.ResetPromptType.enterNoDevices}}, {sessionID})

  expect(answered).toEqual({result: T.RPCGen.ResetPromptResponse.nothing})
  expect(nav.visibleScreen()).toMatchObject({
    name: 'recoverPasswordPromptResetAccount',
    params: {skipPassword: true, username: 'testuser'},
  })
  expect(loggedOutStack()).toEqual(['login', 'recoverPasswordPromptResetAccount'])
  held[0]!.reply(null)
  await flush()
})

test.each([
  ['cancel', T.RPCGen.ResetPromptResponse.cancelReset],
  ['nothing', T.RPCGen.ResetPromptResponse.nothing],
])('submitResetPrompt sends %s responses back to the login flow', async (_, action) => {
  const fake = installFakeEngine()
  const {held, sessionID} = await enter(fake)
  const answered = fake.push(promptReset, completePrompt(false), {sessionID})
  await flush()

  submitResetPrompt(lastResetKey(), action)

  expect(await answered).toEqual({result: action})
  expect(nav.visibleScreen()?.name).toBe('login')
  expect(loggedOutStack()).toEqual(['login'])
  held[0]!.reply(null)
  await flush()
})

test('enterResetPipeline disposes an unconsumed reset prompt when the listener exits', async () => {
  const fake = installFakeEngine()
  const {held, sessionID} = await enter(fake)
  const answered = fake.push(promptReset, completePrompt(false), {sessionID})
  let settled = false
  void answered.then(() => {
    settled = true
  })
  await flush()

  const resetKey = lastResetKey()
  held[0]!.reply(null)
  await flush()

  submitResetPrompt(resetKey, T.RPCGen.ResetPromptResponse.confirmReset)
  await flush()

  expect(settled).toBe(false)
  // provisioning did not start: still on the confirm screen
  expect(nav.visibleScreen()?.name).toBe('resetConfirm')
})

test('reset progress before verification shows the check-your-email screen', async () => {
  const fake = installFakeEngine()
  const {held, sessionID} = await enter(fake)

  await fake.push(resetProgress, {endTime: 1700000000, needVerify: true, text: ''}, {sessionID})
  await flush()

  expect(nav.visibleScreen()).toMatchObject({
    name: 'resetWaiting',
    params: {endTime: undefined, pipelineStarted: false, username: 'testuser'},
  })
  expect(loggedOutStack()).toEqual(['login', 'resetWaiting'])
  held[0]!.reply(null)
  await flush()
})

test('reset progress after verification passes the countdown end time in milliseconds', async () => {
  const fake = installFakeEngine()
  const {held, sessionID} = await enter(fake)

  await fake.push(resetProgress, {endTime: 1700000000, needVerify: false, text: ''}, {sessionID})
  await flush()

  expect(nav.visibleScreen()).toMatchObject({
    name: 'resetWaiting',
    params: {endTime: 1700000000000, pipelineStarted: true, username: 'testuser'},
  })
  expect(loggedOutStack()).toEqual(['login', 'resetWaiting'])
  held[0]!.reply(null)
  await flush()
})

test('a service failure reports its message to the caller', async () => {
  const fake = installFakeEngine()
  const onError = jest.fn()
  const {held} = await enter(fake, onError)
  held[0]!.reply(fakeError(T.RPCGen.StatusCode.scbadloginpassword, 'bad password'))
  await flush()

  expect(onError).toHaveBeenNthCalledWith(1, '')
  expect(onError).toHaveBeenLastCalledWith('bad password')
})

test.each([
  ['a session cancel', T.RPCGen.StatusCode.sccanceled, 'Received RPC cancel for session'],
  ['an input cancel', T.RPCGen.StatusCode.scinputcanceled, 'Input canceled'],
])('%s reports no error', async (_, code, desc) => {
  const fake = installFakeEngine()
  const onError = jest.fn()
  const {held} = await enter(fake, onError)
  held[0]!.reply(fakeError(code, desc))
  await flush()

  // only the clear at the start
  expect(onError).toHaveBeenCalledTimes(1)
  expect(onError).toHaveBeenCalledWith('')
})

// The engine only ever rejects with an RPCError; this is the guard for anything else thrown on the way
test('a non-rpc failure is not reported as a user facing error', async () => {
  const spy = jest.spyOn(T.RPCGen, 'accountEnterResetPipelineRpcListener').mockRejectedValue(new Error('boom'))
  const onError = jest.fn()

  enterResetPipeline({onError, username: 'testuser'})
  await flush()
  spy.mockRestore()

  expect(onError).toHaveBeenCalledTimes(1)
  expect(onError).toHaveBeenCalledWith('')
})
