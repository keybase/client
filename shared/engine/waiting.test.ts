/// <reference types="jest" />
// What a waiting key shows for one RPC, end to end: the session's tracking through the real Engine,
// listener and Dialog, into the waiting store.
import * as T from '@/constants/types'
import {act, renderHook} from '@testing-library/react'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {openDialog} from './dialog'
import {useConfigState} from '@/stores/config'
import {useDispatchClearWaiting, useWaitingState} from '@/stores/waiting'
import {resetAllStores} from '@/util/zustand'
import {tick} from '@/test/flush'

afterEach(() => {
  // The store reset keeps an in-progress switch, and a later test's switch would not start
  useConfigState.getState().dispatch.setUserSwitching(false)
  resetAllStores()
})

const rpc = 'keybase.1.login.recoverPassphrase'
const prompt = 'keybase.1.loginUi.promptPassphraseRecovery'
const choose = 'keybase.1.loginUi.chooseDeviceToRecoverWith'
const explain = 'keybase.1.loginUi.explainDeviceRecovery'
const promiseRpc = 'keybase.1.teams.teamIgnoreRequest'
const waitingKey = 'waiting-test'
const devices = [{deviceID: 'd1', name: 'phone', type: 'mobile'}] as unknown as ReadonlyArray<T.RPCGen.Device>

// The listener hands incoming calls to their handlers on a timer
const afterTimers = async () => new Promise(resolve => setTimeout(resolve, 0))

// The engine throttles waiting changes; flush them before reading the store
const count = (fake: FakeEngine) => {
  fake.engine._throttledDispatchWaitingAction.flush()
  return useWaitingState.getState().counts.get(waitingKey) ?? 0
}
const keyError = (fake: FakeEngine) => {
  fake.engine._throttledDispatchWaitingAction.flush()
  return useWaitingState.getState().errors.get(waitingKey)
}

// Every count the store held for the key, in order
const recordCounts = () => {
  const seen: Array<number> = []
  const unsubscribe = useWaitingState.subscribe(s => {
    const c = s.counts.get(waitingKey) ?? 0
    if (seen.at(-1) !== c) {
      seen.push(c)
    }
  })
  return {seen, unsubscribe}
}

const startPromise = async (fake: FakeEngine) => {
  const held = fake.hold(promiseRpc)
  const ended = T.RPCGen.teamsTeamIgnoreRequestRpcPromise({name: 'team', username: 'testuser'}, waitingKey).catch(
    (e: unknown) => e
  )
  await tick()
  return {ended, held}
}

type Response = {result: (r?: unknown) => void; error: (e: {code: number; desc: string}) => void}

// A listener whose prompt handler keeps each response, so the test answers them
const startListener = async (fake: FakeEngine, onPrompt?: (response: Response) => void) => {
  const held = fake.hold(rpc)
  const responses: Array<Response> = []
  let cancel = () => {}
  const ended = T.RPCGen.loginRecoverPassphraseRpcListener({
    customResponseIncomingCallMap: {
      [prompt]: (_: unknown, response: Response) => {
        responses.push(response)
        onPrompt?.(response)
      },
    },
    incomingCallMap: {},
    onSessionCreated: c => {
      cancel = c
    },
    params: {username: 'testuser'},
    waitingKey,
  }).catch((e: unknown) => e)
  await tick()
  const sessionID = fake.calls[0]!.params.sessionID as number
  const push = async () => fake.push(prompt, {kind: 0}, {sessionID})
  return {cancel: () => cancel(), ended, held, push, responses}
}

const startDialog = async (fake: FakeEngine) => {
  const held = fake.hold(rpc)
  const dialog = openDialog(
    rpc,
    {username: 'testuser'},
    {autoAnswer: {[prompt]: () => true}, notices: [explain], prompts: [choose], waitingKey}
  )
  dialog.done.catch(() => {})
  await tick()
  const sessionID = fake.calls[0]!.params.sessionID as number
  return {dialog, held, sessionID}
}

describe('a promise call', () => {
  test('waits while outstanding and stops at the reply', async () => {
    const fake = installFakeEngine()
    const {ended, held} = await startPromise(fake)
    expect(count(fake)).toBe(1)
    held[0]!.reply(undefined)
    await ended
    expect(count(fake)).toBe(0)
    expect(keyError(fake)).toBeUndefined()
  })

  test("records the service's error on its key", async () => {
    const fake = installFakeEngine()
    const {ended, held} = await startPromise(fake)
    held[0]!.reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'nope'))
    await ended
    expect(count(fake)).toBe(0)
    expect(keyError(fake)).toMatchObject({code: T.RPCGen.StatusCode.scgeneric})
  })

  test('the next call clears the error', async () => {
    const fake = installFakeEngine()
    const first = await startPromise(fake)
    first.held[0]!.reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'nope'))
    await first.ended
    const second = await startPromise(fake)
    expect(keyError(fake)).toBeUndefined()
    second.held[0]!.reply(undefined)
    await second.ended
  })

  test('a link drop stops waiting and records the lost link', async () => {
    const fake = installFakeEngine()
    const {ended} = await startPromise(fake)
    fake.drop()
    await ended
    expect(count(fake)).toBe(0)
    expect(keyError(fake)).toMatchObject({code: 101})
  })

  test('an account switch stops waiting and records nothing', async () => {
    const fake = installFakeEngine()
    useConfigState.getState().dispatch.setLoggedIn(true)
    const {ended, held} = await startPromise(fake)
    useConfigState.getState().dispatch.setUserSwitching(true, 'testuser-mac')
    await ended
    expect(count(fake)).toBe(0)
    expect(keyError(fake)).toBeUndefined()
    held[0]!.reply(undefined)
    await tick()
    expect(count(fake)).toBe(0)
  })
})

describe('a listener', () => {
  test('stops waiting while a prompt is held and waits again after the answer', async () => {
    const fake = installFakeEngine()
    const {ended, held, push, responses} = await startListener(fake)
    expect(count(fake)).toBe(1)
    const pushed = push()
    await afterTimers()
    expect(count(fake)).toBe(0)
    responses[0]!.result(true)
    await pushed
    expect(count(fake)).toBe(1)
    held[0]!.reply(undefined)
    await ended
    expect(count(fake)).toBe(0)
  })

  test('waits again after the service cancels its held prompt', async () => {
    const fake = installFakeEngine()
    const {ended, held, push} = await startListener(fake)
    void push()
    await afterTimers()
    expect(count(fake)).toBe(0)
    fake.cancelPush(prompt)
    expect(count(fake)).toBe(1)
    held[0]!.reply(undefined)
    await ended
    expect(count(fake)).toBe(0)
  })

  test('an account switch stops waiting', async () => {
    const fake = installFakeEngine()
    useConfigState.getState().dispatch.setLoggedIn(true)
    const {ended, held} = await startListener(fake)
    useConfigState.getState().dispatch.setUserSwitching(true, 'testuser-mac')
    await ended
    expect(count(fake)).toBe(0)
    held[0]!.reply(undefined)
    await tick()
    expect(count(fake)).toBe(0)
  })

  test('a link drop stops waiting and records the lost link', async () => {
    const fake = installFakeEngine()
    const {ended} = await startListener(fake)
    fake.drop()
    await ended
    expect(count(fake)).toBe(0)
    expect(keyError(fake)).toMatchObject({code: 101})
  })

  // B1
  test.failing("records the RPC's error when it ends while a prompt is held", async () => {
    const fake = installFakeEngine()
    const {ended, held, push} = await startListener(fake)
    void push()
    await afterTimers()
    held[0]!.reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'nope'))
    await ended
    expect(count(fake)).toBe(0)
    expect(keyError(fake)).toMatchObject({code: T.RPCGen.StatusCode.scgeneric})
  })

  // B2
  test.failing('a client cancel records no error on its key', async () => {
    const fake = installFakeEngine()
    const {cancel, ended, held} = await startListener(fake)
    cancel()
    await ended
    expect(count(fake)).toBe(0)
    expect(keyError(fake)).toBeUndefined()
    held[0]!.reply(undefined)
    await tick()
  })

  // B3
  test.failing('with two prompts held, answering one keeps waiting off', async () => {
    const fake = installFakeEngine()
    const {ended, held, push, responses} = await startListener(fake)
    const first = push()
    const second = push()
    await afterTimers()
    expect(count(fake)).toBe(0)
    responses[0]!.result(true)
    await first
    expect(count(fake)).toBe(0)
    responses[1]!.result(true)
    await second
    expect(count(fake)).toBe(1)
    held[0]!.reply(undefined)
    await ended
    expect(count(fake)).toBe(0)
  })

  // B5
  test.failing('a prompt its handler answers at once never turns waiting off', async () => {
    const fake = installFakeEngine()
    const {ended, held, push} = await startListener(fake, response => response.result(true))
    expect(count(fake)).toBe(1)
    const counts = recordCounts()
    await push()
    await afterTimers()
    expect(count(fake)).toBe(1)
    counts.unsubscribe()
    expect(counts.seen).not.toContain(0)
    held[0]!.reply(undefined)
    await ended
    expect(count(fake)).toBe(0)
  })
})

describe('a dialog', () => {
  test('dispose while a prompt is up stops waiting', async () => {
    const fake = installFakeEngine()
    const {dialog, held, sessionID} = await startDialog(fake)
    const it = dialog.events[Symbol.asyncIterator]()
    void fake.push(choose, {devices}, {sessionID})
    await it.next()
    expect(count(fake)).toBe(0)
    dialog.dispose()
    expect(count(fake)).toBe(0)
    held[0]!.reply(undefined)
    await tick()
    expect(count(fake)).toBe(0)
  })

  // B2
  test.failing('dispose records no error on its key', async () => {
    const fake = installFakeEngine()
    const {dialog, held} = await startDialog(fake)
    dialog.dispose()
    await tick()
    expect(count(fake)).toBe(0)
    expect(keyError(fake)).toBeUndefined()
    held[0]!.reply(undefined)
    await tick()
  })

  // B5
  test.failing('an auto-answered prompt never turns waiting off', async () => {
    const fake = installFakeEngine()
    const {dialog, held, sessionID} = await startDialog(fake)
    expect(count(fake)).toBe(1)
    const counts = recordCounts()
    await fake.push(prompt, {kind: 0}, {sessionID})
    expect(count(fake)).toBe(1)
    counts.unsubscribe()
    expect(counts.seen).not.toContain(0)
    held[0]!.reply(true)
    await dialog.done
    expect(count(fake)).toBe(0)
  })
})

// B6
test.failing("a screen clearing its key's error mid-call keeps the call's waiting", async () => {
  const fake = installFakeEngine()
  const {result} = renderHook(() => useDispatchClearWaiting())
  const first = await startPromise(fake)
  act(() => result.current(waitingKey))
  expect(count(fake)).toBe(1)
  first.held[0]!.reply(undefined)
  await first.ended
  expect(count(fake)).toBe(0)
  const second = await startPromise(fake)
  expect(count(fake)).toBe(1)
  second.held[0]!.reply(undefined)
  await second.ended
})
