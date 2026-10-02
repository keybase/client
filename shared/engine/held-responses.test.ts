/// <reference types="jest" />
// A session settles every response it hands out exactly once: by its handler, or by the session
// when it is cancelled, the service cancels that call, the link drops, or the session ends.
import * as T from '@/constants/types'
import {installFakeEngine, uninstallFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {useConfigState} from '@/stores/config'
import {resetAllStores} from '@/util/zustand'
import {tick} from '@/test/flush'
import logger from '@/logger'
import type {KB2} from '@/util/electron'

const dev = __DEV__
afterEach(() => {
  global.__DEV__ = dev
  // The store reset keeps an in-progress switch, and a later test's switch would not start
  useConfigState.getState().dispatch.setUserSwitching(false)
  resetAllStores()
  jest.restoreAllMocks()
})

const prompt = 'keybase.1.loginUi.promptPassphraseRecovery'
const row = 'keybase.1.identify3Ui.identify3UpdateRow'
const inputCanceled = {code: T.RPCGen.StatusCode.scinputcanceled, desc: 'Input canceled'}

// The listener hands incoming calls to their handlers on a timer
const afterTimers = async () => new Promise(resolve => setTimeout(resolve, 0))
// What a push has settled to by now, or that it is still waiting on the GUI
const settledSoFar = async <V>(p: Promise<V>) => Promise.race([p, tick().then(() => 'still waiting' as const)])

// The transport only logs a second settle, so a double answer shows up here
const watchErrors = () => jest.spyOn(logger, 'error').mockImplementation(() => {})

type PromptResponse = {result: (r: boolean) => void; error: (e: {code: number; desc: string}) => void}

const startRecover = async (fake: FakeEngine, onPrompt: (params: unknown, response: PromptResponse) => void) => {
  const held = fake.hold('keybase.1.login.recoverPassphrase')
  let cancel = () => {}
  const ended = T.RPCGen.loginRecoverPassphraseRpcListener({
    customResponseIncomingCallMap: {[prompt]: onPrompt},
    incomingCallMap: {},
    onSessionCreated: c => {
      cancel = c
    },
    params: {username: 'testuser'},
  }).catch((e: unknown) => e)
  await tick()
  const sessionID = fake.calls[0]!.params.sessionID as number
  return {cancel: () => cancel(), ended, held, push: async () => fake.push(prompt, {kind: 0}, {sessionID})}
}

const startIdentify = async (fake: FakeEngine, onRow: () => void) => {
  const held = fake.hold('keybase.1.identify3.identify3')
  const ended = T.RPCGen.identify3Identify3RpcListener({
    customResponseIncomingCallMap: {},
    incomingCallMap: {[row]: onRow},
    params: {assertion: 'testuser', guiID: '', ignoreCache: false},
  }).catch((e: unknown) => e)
  await tick()
  const sessionID = fake.calls[0]!.params.sessionID as number
  return {ended, held, push: async () => fake.push(row, {row: {}}, {sessionID})}
}

const capture = () => {
  const responses = new Array<PromptResponse>()
  const onPrompt = jest.fn((_: unknown, response: PromptResponse) => {
    responses.push(response)
  })
  return {onPrompt, responses}
}

test('a prompt its handler answers twice writes one response', async () => {
  global.__DEV__ = true
  const logged = watchErrors()
  const warned = jest.spyOn(logger, 'warn').mockImplementation(() => {})
  const fake = installFakeEngine()
  const {push} = await startRecover(fake, (_, response) => {
    response.result(true)
    response.result(false)
  })
  await expect(push()).resolves.toEqual({result: true})
  expect(logged).not.toHaveBeenCalled()
  expect(warned).toHaveBeenCalledTimes(1)
  uninstallFakeEngine()
})

test('a prompt the service cancelled writes nothing when its handler answers late', async () => {
  const fake = installFakeEngine()
  const {onPrompt, responses} = capture()
  const {ended, push} = await startRecover(fake, onPrompt)
  const pushed = push()
  await afterTimers()
  expect(onPrompt).toHaveBeenCalledTimes(1)
  fake.cancelPush(prompt)
  await expect(ended).resolves.toMatchObject({code: T.RPCGen.StatusCode.sccanceled})
  await pushed
  responses[0]!.result(true)
  await tick()
  // The fake records any response to a seqid it is no longer waiting on
  expect(() => uninstallFakeEngine()).not.toThrow()
})

test('a client cancel answers a held prompt once with input canceled', async () => {
  const logged = watchErrors()
  const fake = installFakeEngine()
  const {onPrompt, responses} = capture()
  const {cancel, ended, push} = await startRecover(fake, onPrompt)
  const pushed = push()
  await afterTimers()
  cancel()
  await expect(settledSoFar(pushed)).resolves.toEqual({error: inputCanceled})
  await expect(ended).resolves.toMatchObject({code: T.RPCGen.StatusCode.sccanceled})
  responses[0]!.result(true)
  await tick()
  expect(logged).not.toHaveBeenCalled()
  expect(() => uninstallFakeEngine()).not.toThrow()
})

test('an account switch answers a held prompt once with input canceled', async () => {
  const fake = installFakeEngine()
  useConfigState.getState().dispatch.setLoggedIn(true)
  const {onPrompt} = capture()
  const {push} = await startRecover(fake, onPrompt)
  const pushed = push()
  await afterTimers()
  useConfigState.getState().dispatch.setUserSwitching(true, 'testuser')
  await expect(settledSoFar(pushed)).resolves.toEqual({error: inputCanceled})
  uninstallFakeEngine()
})

test('a held prompt writes nothing once the link dropped, even after it comes back', async () => {
  const fake = installFakeEngine()
  const {onPrompt, responses} = capture()
  const {ended, push} = await startRecover(fake, onPrompt)
  const pushed = push()
  await afterTimers()
  fake.drop()
  await pushed
  await ended
  responses[0]!.result(true)
  fake.restart()
  await tick()
  // A write queued while down would be flushed on restart, and the fake would record it
  expect(() => uninstallFakeEngine()).not.toThrow()
})

test('a held prompt writes nothing once its session ended normally', async () => {
  const fake = installFakeEngine()
  const {onPrompt, responses} = capture()
  const {ended, held, push} = await startRecover(fake, onPrompt)
  const pushed = push()
  await afterTimers()
  held[0]!.reply(undefined)
  await expect(ended).resolves.toBeUndefined()
  responses[0]!.result(true)
  await tick()
  await expect(settledSoFar(pushed)).resolves.toBe('still waiting')
  // The fake still holds the push, so it would record a write as an answer; none came
  uninstallFakeEngine()
})

test('a prompt whose session was cancelled before its handler ran never reaches the handler', async () => {
  const fake = installFakeEngine()
  const {onPrompt} = capture()
  const {cancel, push} = await startRecover(fake, onPrompt)
  const pushed = push()
  cancel()
  await afterTimers()
  expect(onPrompt).not.toHaveBeenCalled()
  await expect(settledSoFar(pushed)).resolves.toEqual({error: inputCanceled})
  uninstallFakeEngine()
})

test('a prompt queued before a logout is refused instead of reaching its handler', async () => {
  const fake = installFakeEngine()
  useConfigState.getState().dispatch.setLoggedIn(true)
  const onConfirm = jest.fn()
  fake.hold('keybase.1.teams.teamDelete')
  const ended = T.RPCGen.teamsTeamDeleteRpcListener({
    customResponseIncomingCallMap: {'keybase.1.teamsUi.confirmRootTeamDelete': onConfirm},
    incomingCallMap: {},
    params: {teamID: 'teamid'},
  }).catch((e: unknown) => e)
  await tick()
  const sessionID = fake.calls[0]!.params.sessionID as number
  const pushed = fake.push('keybase.1.teamsUi.confirmRootTeamDelete', {teamName: 'testteam'}, {sessionID})
  useConfigState.getState().dispatch.setLoggedIn(false)
  await afterTimers()
  expect(onConfirm).not.toHaveBeenCalled()
  await expect(settledSoFar(pushed)).resolves.toEqual({error: inputCanceled})
  uninstallFakeEngine()
  await ended
})

test('a notification that arrives just before its session ends normally still reaches its handler', async () => {
  const fake = installFakeEngine()
  const onRow = jest.fn()
  const {ended, held, push} = await startIdentify(fake, onRow)
  const pushed = push()
  held[0]!.reply(undefined)
  await expect(ended).resolves.toBeUndefined()
  expect(onRow).not.toHaveBeenCalled()
  await afterTimers()
  expect(onRow).toHaveBeenCalledTimes(1)
  await expect(pushed).resolves.toEqual({result: undefined})
  uninstallFakeEngine()
})

test('a notification queued before an account switch never reaches its handler', async () => {
  const fake = installFakeEngine()
  useConfigState.getState().dispatch.setLoggedIn(true)
  const onRow = jest.fn()
  const {push} = await startIdentify(fake, onRow)
  const pushed = push()
  useConfigState.getState().dispatch.setUserSwitching(true, 'testuser')
  await afterTimers()
  expect(onRow).not.toHaveBeenCalled()
  await expect(pushed).resolves.toEqual({result: undefined})
  uninstallFakeEngine()
})

test('a raw session acks a call from its incomingCallMap itself', async () => {
  const onEngineIncoming = jest.fn()
  const fake = installFakeEngine({onEngineIncoming})
  const onRow = jest.fn()
  const session = fake.engine.createSession({incomingCallMap: {[row]: onRow}})
  await expect(settledSoFar(fake.push(row, {row: {}}, {sessionID: session.getId()}))).resolves.toEqual({
    result: undefined,
  })
  expect(onRow).toHaveBeenCalledWith(expect.objectContaining({row: {}}))
  expect(onEngineIncoming).not.toHaveBeenCalled()
  session.end()
  uninstallFakeEngine()
})

test('a session prompt handler that throws is answered once with input canceled', async () => {
  const logged = watchErrors()
  const fake = installFakeEngine()
  const session = fake.engine.createSession({
    customResponseIncomingCallMap: {
      'keybase.1.secretUi.getPassphrase': () => {
        throw new Error('handler broke')
      },
    },
  })
  const pushed = fake.push('keybase.1.secretUi.getPassphrase', {pinentry: {}}, {sessionID: session.getId()})
  await expect(settledSoFar(pushed)).resolves.toEqual({error: inputCanceled})
  expect(logged).toHaveBeenCalledTimes(1)
  session.cancel()
  await tick()
  expect(() => uninstallFakeEngine()).not.toThrow()
})

// A session that was never started has no call for the transport to fail, so only the engine's
// own disconnect and reset handling settle what it holds.
const holdPassphrase = (fake: FakeEngine, dangling: boolean) => {
  const responses = new Array<{result: (r: T.RPCGen.GetPassphraseRes) => void}>()
  const session = fake.engine.createSession({
    customResponseIncomingCallMap: {
      'keybase.1.secretUi.getPassphrase': (_, response) => {
        responses.push(response)
      },
    },
    dangling,
  })
  const pushed = fake.push('keybase.1.secretUi.getPassphrase', {pinentry: {}}, {sessionID: session.getId()})
  return {pushed, responses}
}

test('an unstarted session holding a prompt writes nothing when the link drops', async () => {
  const fake = installFakeEngine()
  const {pushed, responses} = holdPassphrase(fake, false)
  fake.drop()
  await pushed
  responses[0]!.result({passphrase: 'testpass', storeSecret: false})
  fake.restart()
  await tick()
  expect(() => uninstallFakeEngine()).not.toThrow()
})

test.each([false, true])('a reset drops a held prompt without answering it (dangling %p)', async dangling => {
  const fake = installFakeEngine()
  const {pushed, responses} = holdPassphrase(fake, dangling)
  const preload = globalThis._fromPreload as KB2
  const {isRenderer} = preload.constants
  // node's engine is the one that replaces its client on reset
  preload.constants.isRenderer = false
  try {
    fake.engine.reset()
  } finally {
    preload.constants.isRenderer = isRenderer
  }
  responses[0]!.result({passphrase: 'testpass', storeSecret: false})
  await tick()
  await expect(settledSoFar(pushed)).resolves.toBe('still waiting')
  uninstallFakeEngine()
})
