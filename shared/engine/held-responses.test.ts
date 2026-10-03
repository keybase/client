/// <reference types="jest" />
// A session settles every response it hands out exactly once: by its handler, or by the session
// when it is cancelled, the service cancels that call, the link drops, or the session ends.
import * as T from '@/constants/types'
import {installFakeEngine, uninstallFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {useConfigState} from '@/stores/config'
import {useWaitingState} from '@/stores/waiting'
import {resetAllStores} from '@/util/zustand'
import {tick} from '@/test/flush'
import logger from '@/logger'
import {testWaitingKey} from '@/test/waiting-key'
import type {WaitingKey} from '@/constants/waiting-key-type'

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

// The listener hands incoming calls to their handlers on a timer, and a prompt they leave unanswered
// becomes the GUI's on the next
const afterTimers = async () => {
  await new Promise(resolve => setTimeout(resolve, 0))
  await new Promise(resolve => setTimeout(resolve, 0))
}
// What a push has settled to by now, or that it is still waiting on the GUI
const settledSoFar = async <V>(p: Promise<V>) => Promise.race([p, tick().then(() => 'still waiting' as const)])

// The transport only logs a second settle, so a double answer shows up here
const watchErrors = () => jest.spyOn(logger, 'error').mockImplementation(() => {})

type PromptResponse = {result: (r: boolean) => void; error: (e: {code: number; desc: string}) => void}

const startRecover = async (
  fake: FakeEngine,
  onPrompt: (params: unknown, response: PromptResponse) => void | Promise<void>,
  waitingKey?: WaitingKey
) => {
  const held = fake.hold('keybase.1.login.recoverPassphrase')
  let cancel = () => {}
  const ended = T.RPCGen.loginRecoverPassphraseRpcListener({
    // Typed void, but the listener awaits what a handler returns, so a rejection reaches it
    customResponseIncomingCallMap: {[prompt]: onPrompt as (params: unknown, response: PromptResponse) => void},
    incomingCallMap: {},
    onSessionCreated: c => {
      cancel = c
    },
    params: {username: 'testuser'},
    waitingKey,
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
  const {ended, held, push} = await startRecover(fake, onPrompt)
  const pushed = push()
  await afterTimers()
  expect(onPrompt).toHaveBeenCalledTimes(1)
  fake.cancelPush(prompt)
  await pushed
  responses[0]!.result(true)
  await tick()
  held[0]!.reply(undefined)
  await expect(ended).resolves.toBeUndefined()
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
  fake.hold('keybase.1.device.deviceAdd')
  void T.RPCGen.deviceDeviceAddRpcListener({
    params: undefined,
    customResponseIncomingCallMap: {'keybase.1.provisionUi.chooseDeviceType': () => {}},
    incomingCallMap: {},
  }).catch(() => {})
  await tick()
  const sessionID = fake.calls[0]!.params.sessionID as number
  const pushed = fake.push('keybase.1.provisionUi.chooseDeviceType', {kind: 0}, {sessionID})
  await afterTimers()
  useConfigState.getState().dispatch.setUserSwitching(true, 'testuser')
  await expect(settledSoFar(pushed)).resolves.toEqual({error: inputCanceled})
  uninstallFakeEngine()
})

test('an account switch leaves a recovery prompt held: the recovery outlives the account', async () => {
  const fake = installFakeEngine()
  useConfigState.getState().dispatch.setLoggedIn(true)
  const {onPrompt, responses} = capture()
  const {ended, held, push} = await startRecover(fake, onPrompt)
  const pushed = push()
  await afterTimers()
  useConfigState.getState().dispatch.setUserSwitching(true, 'testuser')
  await expect(settledSoFar(pushed)).resolves.toBe('still waiting')
  responses[0]!.result(true)
  await expect(pushed).resolves.toEqual({result: true})
  held[0]!.reply(undefined)
  await expect(ended).resolves.toBeUndefined()
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

test('a raw session refuses a must-answer call that reached its incomingCallMap instead of acking it', async () => {
  const logged = watchErrors()
  const fake = installFakeEngine()
  const onPrompt = jest.fn()
  // The generated types keep a must-answer method out of the plain map, so only a cast gets it there
  const session = fake.engine.createSession({incomingCallMap: {[prompt]: onPrompt} as never})
  await expect(settledSoFar(fake.push(prompt, {kind: 0}, {sessionID: session.getId()}))).resolves.toEqual({
    error: {code: T.RPCGen.StatusCode.scinputcanceled, desc: `No handler for ${prompt}`},
  })
  expect(onPrompt).not.toHaveBeenCalled()
  expect(logged).toHaveBeenCalledTimes(1)
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
  session.cancel('caller')
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
  return {pushed, responses, session}
}

test.each([false, true])('an unstarted session holding a prompt writes nothing when the link drops (dangling %p)', async dangling => {
  const fake = installFakeEngine()
  const {pushed, responses, session} = holdPassphrase(fake, dangling)
  fake.drop()
  await pushed
  // A dangling session outlives the link; only what it held is dropped
  expect(fake.engine._sessionsMap.has(session.getId())).toBe(dangling)
  responses[0]!.result({passphrase: 'testpass', storeSecret: false})
  fake.restart()
  await tick()
  expect(() => uninstallFakeEngine()).not.toThrow()
})

test.each([false, true])('a reset drops a held prompt without answering it (dangling %p)', async dangling => {
  const fake = installFakeEngine()
  const {pushed, responses} = holdPassphrase(fake, dangling)
  fake.engine.reset()
  responses[0]!.result({passphrase: 'testpass', storeSecret: false})
  await tick()
  await expect(settledSoFar(pushed)).resolves.toBe('still waiting')
  uninstallFakeEngine()
})

describe('a listener prompt handler that fails', () => {
  test.each([
    [
      'throws',
      () => {
        throw new Error('handler broke')
      },
    ],
    ['rejects', async () => Promise.reject(new Error('handler broke'))],
  ])('is answered once with input canceled when it %s', async (_, onPrompt) => {
    const logged = watchErrors()
    const fake = installFakeEngine()
    const {push} = await startRecover(fake, onPrompt)
    const pushed = push()
    await afterTimers()
    await expect(settledSoFar(pushed)).resolves.toEqual({error: inputCanceled})
    expect(logged).toHaveBeenCalled()
    expect(() => uninstallFakeEngine()).not.toThrow()
  })

  test('that already answered writes nothing more', async () => {
    global.__DEV__ = true
    watchErrors()
    const warned = jest.spyOn(logger, 'warn').mockImplementation(() => {})
    const fake = installFakeEngine()
    const {push} = await startRecover(fake, (__, response) => {
      response.result(true)
      throw new Error('handler broke after answering')
    })
    const pushed = push()
    await afterTimers()
    await expect(pushed).resolves.toEqual({result: true})
    await tick()
    expect(warned).not.toHaveBeenCalled()
    expect(() => uninstallFakeEngine()).not.toThrow()
  })
})

describe('a late answer leaves the waiting count alone', () => {
  const waitingKey = testWaitingKey('held-responses-test')
  const waitingCount = (fake: FakeEngine) => {
    fake.engine._throttledDispatchWaitingAction.flush()
    return useWaitingState.getState().counts.get(waitingKey) ?? 0
  }

  test('after a client cancel', async () => {
    const fake = installFakeEngine()
    const {onPrompt, responses} = capture()
    const {cancel, ended, push} = await startRecover(fake, onPrompt, waitingKey)
    expect(waitingCount(fake)).toBe(1)
    void push()
    await afterTimers()
    expect(waitingCount(fake)).toBe(0)
    cancel()
    await ended
    responses[0]!.result(true)
    expect(waitingCount(fake)).toBe(0)
    uninstallFakeEngine()
  })

  test('after a raw session refused a prompt its handler threw on', async () => {
    watchErrors()
    const fake = installFakeEngine()
    const held = fake.hold('keybase.1.login.recoverPassphrase')
    const ended = new Promise(resolve => {
      fake.engine.call({
        callback: resolve,
        customResponseIncomingCallMap: {
          [prompt]: () => {
            throw new Error('handler broke')
          },
        },
        method: 'keybase.1.login.recoverPassphrase',
        params: {username: 'testuser'},
        waitingKey,
      })
    })
    await tick()
    expect(waitingCount(fake)).toBe(1)
    const sessionID = fake.calls[0]!.params.sessionID as number
    await expect(fake.push(prompt, {kind: 0}, {sessionID})).resolves.toEqual({error: inputCanceled})
    // The session goes on, so it is waiting on the service again
    expect(waitingCount(fake)).toBe(1)
    held[0]!.reply(undefined)
    await ended
    expect(waitingCount(fake)).toBe(0)
    uninstallFakeEngine()
  })

  test('after its session ended', async () => {
    const fake = installFakeEngine()
    const {onPrompt, responses} = capture()
    const {ended, held, push} = await startRecover(fake, onPrompt, waitingKey)
    void push()
    await afterTimers()
    held[0]!.reply(undefined)
    await ended
    expect(waitingCount(fake)).toBe(0)
    responses[0]!.result(true)
    expect(waitingCount(fake)).toBe(0)
    uninstallFakeEngine()
  })
})
