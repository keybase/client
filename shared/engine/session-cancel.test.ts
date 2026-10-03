/// <reference types="jest" />
// A client-cancelled session refuses the service's late calls on it until its RPC ends, so none of
// them reaches a global answerer or the app's incoming handlers.
import * as T from '@/constants/types'
import type * as EngineGen from '@/constants/rpc'
import {installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {registerIncomingAnswerer} from './incoming-answerers'
import {useConfigState} from '@/stores/config'
import {useWaitingState} from '@/stores/waiting'
import {resetAllStores} from '@/util/zustand'
import {tick} from '@/test/flush'

const unregisters = new Array<() => void>()
afterEach(() => {
  unregisters.splice(0).forEach(u => u())
  // The store reset keeps an in-progress switch, and a later test's switch would not start
  useConfigState.getState().dispatch.setUserSwitching(false)
  resetAllStores()
})

const rpc = 'keybase.1.login.recoverPassphrase'
const prompt = 'keybase.1.loginUi.promptPassphraseRecovery'
const pinentry = 'keybase.1.secretUi.getPassphrase'
const log = 'keybase.1.logUi.log'
const inputCanceled = {code: T.RPCGen.StatusCode.scinputcanceled, desc: 'Input canceled'}
const waitingKey = 'session-cancel-test'

// The listener hands incoming calls to their handlers on a timer, and a prompt they leave unanswered
// becomes the GUI's on the next
const afterTimers = async () => {
  await new Promise(resolve => setTimeout(resolve, 0))
  await new Promise(resolve => setTimeout(resolve, 0))
}

const registerPinentry = () => {
  // Answers, so a push that wrongly reaches it does not hang
  const answered = jest.fn((_: unknown, response: {error: (e: {code: number; desc: string}) => void}) =>
    response.error({code: T.RPCGen.StatusCode.scgeneric, desc: 'global answerer'})
  )
  unregisters.push(registerIncomingAnswerer(pinentry, answered))
  return answered
}

const start = async (onEngineIncoming?: (a: EngineGen.Actions) => void) => {
  const fake = installFakeEngine({onEngineIncoming})
  const held = fake.hold(rpc)
  const onPrompt = jest.fn()
  let cancel = () => {}
  const ended = T.RPCGen.loginRecoverPassphraseRpcListener({
    customResponseIncomingCallMap: {[prompt]: onPrompt},
    globalFallthrough: ['keybase.1.secretUi.', 'keybase.1.logUi.'],
    incomingCallMap: {},
    onSessionCreated: c => {
      cancel = c
    },
    params: {username: 'testuser'},
    waitingKey,
  }).catch((e: unknown) => e)
  await tick()
  const sessionID = fake.calls[0]!.params.sessionID as number
  return {cancel: () => cancel(), ended, fake, held, onPrompt, sessionID}
}

const waitingCount = (fake: FakeEngine) => {
  fake.engine._throttledDispatchWaitingAction.flush()
  return useWaitingState.getState().counts.get(waitingKey) ?? 0
}

test('a late prompt on a cancelled session is refused and never reaches a global answerer', async () => {
  const answered = registerPinentry()
  const {cancel, ended, fake, sessionID} = await start()
  cancel()
  await expect(ended).resolves.toMatchObject({code: T.RPCGen.StatusCode.sccanceled})
  await expect(fake.push(pinentry, {pinentry: {}, terminal: null}, {sessionID})).resolves.toEqual({
    error: inputCanceled,
  })
  expect(answered).not.toHaveBeenCalled()
})

test("a late prompt from the session's own map is refused without reaching its handler", async () => {
  const {cancel, fake, onPrompt, sessionID} = await start()
  cancel()
  await expect(fake.push(prompt, {kind: 0}, {sessionID})).resolves.toEqual({error: inputCanceled})
  await afterTimers()
  expect(onPrompt).not.toHaveBeenCalled()
})

test('a late plain call on a cancelled session is acked and never reaches the app', async () => {
  const onEngineIncoming = jest.fn()
  const {cancel, fake, sessionID} = await start(onEngineIncoming)
  cancel()
  await expect(fake.push(log, {level: 0, text: {data: 'hi', markup: false}}, {sessionID})).resolves.toEqual({
    result: undefined,
  })
  expect(onEngineIncoming).not.toHaveBeenCalled()
})

test('the RPC reply ends the refusal and removes the session', async () => {
  const {cancel, fake, held, sessionID} = await start()
  expect(fake.engine._sessionSummary()).toEqual([{id: sessionID, method: rpc}])
  cancel()
  expect(fake.engine._sessionsMap.has(sessionID)).toBe(true)
  expect(fake.engine._sessionSummary()).toEqual([{id: sessionID, method: rpc, refusing: true}])
  held[0]!.reply(undefined)
  await tick()
  expect(fake.engine._sessionsMap.has(sessionID)).toBe(false)
})

test('a link drop ends the refusal', async () => {
  const {cancel, fake, sessionID} = await start()
  cancel()
  fake.drop()
  expect(fake.engine._sessionsMap.has(sessionID)).toBe(false)
})

test('an engine reset ends the refusal', async () => {
  const {cancel, fake, sessionID} = await start()
  cancel()
  fake.engine.reset()
  expect(fake.engine._sessionsMap.has(sessionID)).toBe(false)
})

test('an account switch rejects the caller at once and refuses late prompts until the reply', async () => {
  const answered = registerPinentry()
  const onEngineIncoming = jest.fn()
  useConfigState.getState().dispatch.setLoggedIn(true)
  const {ended, fake, held, sessionID} = await start(onEngineIncoming)
  useConfigState.getState().dispatch.setUserSwitching(true, 'testuser-mac')
  await expect(ended).resolves.toMatchObject({code: T.RPCGen.StatusCode.sccanceled})
  await expect(fake.push(pinentry, {pinentry: {}, terminal: null}, {sessionID})).resolves.toEqual({
    error: inputCanceled,
  })
  expect(answered).not.toHaveBeenCalled()
  expect(onEngineIncoming).not.toHaveBeenCalled()
  held[0]!.reply(undefined)
  await tick()
  expect(fake.engine._sessionsMap.has(sessionID)).toBe(false)
})

describe('the waiting count', () => {
  test('returns to 0 after a cancel, late prompts and the reply', async () => {
    const {cancel, fake, held, sessionID} = await start()
    expect(waitingCount(fake)).toBe(1)
    cancel()
    expect(waitingCount(fake)).toBe(0)
    await fake.push(prompt, {kind: 0}, {sessionID})
    expect(waitingCount(fake)).toBe(0)
    held[0]!.reply(undefined)
    await tick()
    expect(waitingCount(fake)).toBe(0)
  })

  test('of a raw call is released once when it is cancelled and its reply comes later', async () => {
    const fake = installFakeEngine()
    const held = fake.hold(rpc)
    const ended = new Promise(resolve => {
      fake.engine.call({callback: resolve, method: rpc, params: {username: 'testuser'}, waitingKey})
    })
    await tick()
    expect(waitingCount(fake)).toBe(1)
    fake.engine.cancelSession(fake.calls[0]!.params.sessionID as number)
    await ended
    expect(waitingCount(fake)).toBe(0)
    held[0]!.reply(undefined)
    await tick()
    expect(waitingCount(fake)).toBe(0)
  })
})

test("a listener handler sees its response's settled state through the waiting wrapper", async () => {
  const {cancel, fake, onPrompt, sessionID} = await start()
  void fake.push(prompt, {kind: 0}, {sessionID})
  await afterTimers()
  const response = onPrompt.mock.calls[0]![1] as {settled?: boolean}
  expect(response.settled).toBe(false)
  cancel()
  expect(response.settled).toBe(true)
})

// Go cancels one prompt's context and goes on with the RPC, e.g. login's DisplayAndPromptSecret
// once the other device finished, followed by ProvisioneeSuccess.
describe('a service cancel of one prompt', () => {
  test('settles only that prompt, and the session handles later calls and the reply', async () => {
    const answered = registerPinentry()
    const {ended, fake, held, onPrompt, sessionID} = await start()
    const first = fake.push(prompt, {kind: 0}, {sessionID})
    await afterTimers()
    fake.cancelPush(prompt)
    await expect(first).resolves.toMatchObject({error: {code: T.RPCGen.StatusCode.sccanceled}})
    expect(fake.engine._sessionsMap.get(sessionID)?.isRefusing()).toBe(false)
    const second = fake.push(prompt, {kind: 0}, {sessionID})
    await afterTimers()
    expect(onPrompt).toHaveBeenCalledTimes(2)
    ;(onPrompt.mock.calls[1]![1] as {result: (r: boolean) => void}).result(true)
    await expect(second).resolves.toEqual({result: true})
    expect(answered).not.toHaveBeenCalled()
    held[0]!.reply(undefined)
    await expect(ended).resolves.toBeUndefined()
    expect(fake.engine._sessionsMap.has(sessionID)).toBe(false)
  })

  test("turns a listener's waiting back on, as its RPC goes on", async () => {
    const {ended, fake, held, onPrompt, sessionID} = await start()
    expect(waitingCount(fake)).toBe(1)
    void fake.push(prompt, {kind: 0}, {sessionID})
    await afterTimers()
    expect(onPrompt).toHaveBeenCalledTimes(1)
    expect(waitingCount(fake)).toBe(0)
    fake.cancelPush(prompt)
    expect(waitingCount(fake)).toBe(1)
    held[0]!.reply(undefined)
    await ended
    expect(waitingCount(fake)).toBe(0)
  })

  // The GUI owes the service only once the handler has run and left the prompt unanswered
  test("still on the listener's timer, keeps its waiting on and never reaches the handler", async () => {
    const {ended, fake, held, onPrompt, sessionID} = await start()
    void fake.push(prompt, {kind: 0}, {sessionID})
    await tick()
    expect(waitingCount(fake)).toBe(1)
    fake.cancelPush(prompt)
    expect(waitingCount(fake)).toBe(1)
    await afterTimers()
    expect(onPrompt).not.toHaveBeenCalled()
    held[0]!.reply(undefined)
    await ended
    expect(waitingCount(fake)).toBe(0)
  })

  test("leaves a raw call's waiting count on the service until its reply", async () => {
    const fake = installFakeEngine()
    const held = fake.hold(rpc)
    const onPrompt = jest.fn()
    const ended = new Promise(resolve => {
      fake.engine.call({
        callback: resolve,
        customResponseIncomingCallMap: {[prompt]: onPrompt},
        method: rpc,
        params: {username: 'testuser'},
        waitingKey,
      })
    })
    await tick()
    const sessionID = fake.calls[0]!.params.sessionID as number
    void fake.push(prompt, {kind: 0}, {sessionID})
    await afterTimers()
    expect(onPrompt).toHaveBeenCalledTimes(1)
    expect(waitingCount(fake)).toBe(0)
    fake.cancelPush(prompt)
    expect(waitingCount(fake)).toBe(1)
    held[0]!.reply(undefined)
    await ended
    expect(waitingCount(fake)).toBe(0)
  })
})
