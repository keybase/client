/// <reference types="jest" />
import * as T from '@/constants/types'
import type * as EngineGen from '@/constants/rpc'
import {errors} from './rpc-transport'
import {installFakeEngine, uninstallFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {registerIncomingAnswerer} from './incoming-answerers'
import {disposeDialogsForLogout, openDialog} from './dialog'
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
const choose = 'keybase.1.loginUi.chooseDeviceToRecoverWith'
const pgpWarning = 'keybase.1.loginUi.promptPassphraseRecovery'
const resetPrompt = 'keybase.1.loginUi.promptResetAccount'
const explain = 'keybase.1.loginUi.explainDeviceRecovery'
const progress = 'keybase.1.loginUi.displayResetProgress'
const pinentry = 'keybase.1.secretUi.getPassphrase'
const pgpRpc = 'keybase.1.pgp.pgpKeyGenDefault'
const pushPrivate = 'keybase.1.pgpUi.shouldPushPrivate'
const inputCanceled = {code: T.RPCGen.StatusCode.scinputcanceled, desc: 'Input canceled'}
const waitingKey = 'dialog-test'

// The listener hands incoming calls to their handlers on a timer
const afterTimers = async () => new Promise(resolve => setTimeout(resolve, 0))

const waitingCount = (fake: FakeEngine) => {
  fake.engine._throttledDispatchWaitingAction.flush()
  return useWaitingState.getState().counts.get(waitingKey) ?? 0
}

const settledError = async (p: Promise<unknown>) => p.then(
  () => {
    throw new Error('expected a rejection')
  },
  (e: unknown) => e
)

const startRecover = async (onEngineIncoming?: (a: EngineGen.Actions) => void) => {
  const fake = installFakeEngine({onEngineIncoming})
  const held = fake.hold(rpc)
  const dialog = openDialog(
    rpc,
    {username: 'testuser'},
    {
      autoAnswer: {[pgpWarning]: () => true, [resetPrompt]: () => 'refuse'},
      globalFallthrough: ['keybase.1.logUi.'],
      notices: [explain, progress],
      prompts: [choose, pinentry],
      waitingKey,
    }
  )
  await tick()
  const sessionID = fake.calls[0]!.params.sessionID as number
  return {dialog, fake, held, sessionID}
}

// Reads events into an array until the iterator ends
const collect = <E>(events: AsyncIterable<E>) => {
  const seen: Array<E> = []
  const finished = (async () => {
    for await (const e of events) {
      seen.push(e)
    }
  })()
  return {finished, seen}
}

const nextEvent = async <E,>(it: AsyncIterator<E>) => {
  const r = await it.next()
  if (r.done) throw new Error('events ended')
  return r.value
}

const devices = [{deviceID: 'd1', name: 'phone', type: 'mobile'}] as unknown as ReadonlyArray<T.RPCGen.Device>

test('a surfaced prompt carries its typed params and an answer reaches the service once', async () => {
  const {dialog, fake, held, sessionID} = await startRecover()
  const it = dialog.events[Symbol.asyncIterator]()
  const pushed = fake.push(choose, {devices}, {sessionID})
  const e = await nextEvent(it)
  if (e.kind !== 'prompt' || e.method !== choose) throw new Error('expected the choose prompt')
  expect(e.params.devices?.[0]?.name).toBe('phone')
  expect(e.open).toBe(true)
  expect(dialog.openPrompts()).toEqual([e])
  expect(dialog.prompt(e.id, choose)).toBe(e)
  expect(dialog.prompt(e.id, pinentry)).toBeUndefined()
  expect(e.answer('d1')).toBe(true)
  expect(e.open).toBe(false)
  expect(e.answer('d2')).toBe(false)
  expect(e.cancel()).toBe(false)
  await expect(pushed).resolves.toEqual({result: 'd1'})
  await expect(e.closed).resolves.toBe('answered')
  expect(dialog.openPrompts()).toEqual([])
  expect(dialog.prompt(e.id, choose)).toBeUndefined()
  held[0]!.reply(undefined)
  await expect(dialog.done).resolves.toBeUndefined()
  expect(dialog.disposed).toBe(false)
})

test('a cancelled prompt refuses the service with input canceled, once', async () => {
  const {dialog, fake, held, sessionID} = await startRecover()
  const it = dialog.events[Symbol.asyncIterator]()
  const pushed = fake.push(choose, {devices}, {sessionID})
  const e = await nextEvent(it)
  if (e.kind !== 'prompt') throw new Error('expected a prompt')
  expect(e.cancel()).toBe(true)
  expect(e.cancel()).toBe(false)
  expect(e.answer('d1' as never)).toBe(false)
  await expect(pushed).resolves.toEqual({error: inputCanceled})
  await expect(e.closed).resolves.toBe('cancelled')
  held[0]!.reply(undefined)
  await dialog.done
})

test('autoAnswer answers with a value or refuses, and never surfaces the prompt', async () => {
  const {dialog, fake, held, sessionID} = await startRecover()
  const {finished, seen} = collect(dialog.events)
  await expect(
    fake.push(pgpWarning, {kind: T.RPCGen.PassphraseRecoveryPromptType.encryptedPgpKeys}, {sessionID})
  ).resolves.toEqual({result: true})
  await expect(fake.push(resetPrompt, {prompt: {t: 0}}, {sessionID})).resolves.toEqual({error: inputCanceled})
  held[0]!.reply(undefined)
  await dialog.done
  await finished
  expect(seen).toEqual([])
})

test('events keep arrival order, and a notice that arrived before the reply is still delivered', async () => {
  const {dialog, fake, held, sessionID} = await startRecover()
  const {finished, seen} = collect(dialog.events)
  void fake.push(explain, {kind: T.RPCGen.DeviceType.mobile, name: 'phone'}, {sessionID})
  void fake.push(choose, {devices}, {sessionID})
  void fake.push(progress, {endTime: 0, needVerify: false, text: 'a'}, {sessionID})
  await afterTimers()
  // The progress handler is still on the listener's timer when the reply lands
  void fake.push(progress, {endTime: 0, needVerify: false, text: 'b'}, {sessionID})
  held[0]!.reply(undefined)
  await dialog.done
  await finished
  expect(seen.map(e => (e.kind === 'notice' ? `${e.method}:${JSON.stringify(e.params)}` : e.method))).toEqual([
    `${explain}:${JSON.stringify({kind: T.RPCGen.DeviceType.mobile, name: 'phone', sessionID})}`,
    choose,
    `${progress}:${JSON.stringify({endTime: 0, needVerify: false, text: 'a', sessionID})}`,
    `${progress}:${JSON.stringify({endTime: 0, needVerify: false, text: 'b', sessionID})}`,
  ])
})

test('when done resolves, an open prompt ends without writing, and the iterator finishes', async () => {
  const {dialog, fake, held, sessionID} = await startRecover()
  const it = dialog.events[Symbol.asyncIterator]()
  const pushed = fake.push(choose, {devices}, {sessionID})
  const e = await nextEvent(it)
  if (e.kind !== 'prompt') throw new Error('expected a prompt')
  held[0]!.reply(undefined)
  await dialog.done
  await expect(e.closed).resolves.toBe('ended')
  expect(e.open).toBe(false)
  expect(e.answer('d1' as never)).toBe(false)
  await expect(it.next()).resolves.toEqual({done: true, value: undefined})
  // The GUI wrote nothing to the push
  let answered = false
  void pushed.then(() => (answered = true))
  await tick()
  expect(answered).toBe(false)
})

test("the service cancelling a prompt closes it and rejects done", async () => {
  const {dialog, fake, sessionID} = await startRecover()
  const it = dialog.events[Symbol.asyncIterator]()
  void fake.push(choose, {devices}, {sessionID})
  const e = await nextEvent(it)
  if (e.kind !== 'prompt') throw new Error('expected a prompt')
  fake.cancelPush(choose)
  expect(e.open).toBe(false)
  expect(e.answer('d1' as never)).toBe(false)
  await expect(settledError(dialog.done)).resolves.toMatchObject({code: T.RPCGen.StatusCode.sccanceled})
  await expect(e.closed).resolves.toBe('ended')
  await expect(it.next()).resolves.toMatchObject({done: true})
  expect(dialog.disposed).toBe(false)
})

test('a link drop closes prompts and rejects done with EOF', async () => {
  const {dialog, fake, sessionID} = await startRecover()
  const it = dialog.events[Symbol.asyncIterator]()
  void fake.push(choose, {devices}, {sessionID})
  const e = await nextEvent(it)
  if (e.kind !== 'prompt') throw new Error('expected a prompt')
  fake.drop()
  expect(e.open).toBe(false)
  await expect(settledError(dialog.done)).resolves.toMatchObject({code: errors.EOF})
  await expect(e.closed).resolves.toBe('ended')
  await expect(it.next()).resolves.toMatchObject({done: true})
})

describe('dispose', () => {
  test('refuses open prompts and later ones, ends the iterator, rejects done and sets disposed', async () => {
    const answered = jest.fn((_: unknown, response: {error: (e: {code: number; desc: string}) => void}) =>
      response.error({code: T.RPCGen.StatusCode.scgeneric, desc: 'global answerer'})
    )
    unregisters.push(registerIncomingAnswerer(pinentry, answered))
    const onEngineIncoming = jest.fn()
    const {dialog, fake, held, sessionID} = await startRecover(onEngineIncoming)
    const it = dialog.events[Symbol.asyncIterator]()
    const pushed = fake.push(choose, {devices}, {sessionID})
    const e = await nextEvent(it)
    if (e.kind !== 'prompt') throw new Error('expected a prompt')
    const pending = it.next()
    dialog.dispose()
    expect(dialog.disposed).toBe(true)
    expect(e.open).toBe(false)
    expect(dialog.openPrompts()).toEqual([])
    await expect(pushed).resolves.toEqual({error: inputCanceled})
    await expect(e.closed).resolves.toBe('cancelled')
    await expect(pending).resolves.toEqual({done: true, value: undefined})
    await expect(settledError(dialog.done)).resolves.toMatchObject({code: T.RPCGen.StatusCode.sccanceled})
    // The service is refused on the session until its RPC ends, and nothing goes global
    await expect(fake.push(pinentry, {pinentry: {}, terminal: null}, {sessionID})).resolves.toEqual({
      error: inputCanceled,
    })
    await expect(fake.push(choose, {devices}, {sessionID})).resolves.toEqual({error: inputCanceled})
    await expect(fake.push(explain, {kind: 0, name: 'x'}, {sessionID})).resolves.toEqual({result: undefined})
    await afterTimers()
    expect(answered).not.toHaveBeenCalled()
    expect(onEngineIncoming).not.toHaveBeenCalled()
    dialog.dispose()
    held[0]!.reply(undefined)
    await tick()
    expect(fake.engine._sessionsMap.has(sessionID)).toBe(false)
  })

  test('works straight after openDialog returns', async () => {
    const fake = installFakeEngine()
    const held = fake.hold(rpc)
    const dialog = openDialog(rpc, {username: 'testuser'}, {prompts: [choose]})
    dialog.dispose()
    await expect(settledError(dialog.done)).resolves.toMatchObject({code: T.RPCGen.StatusCode.sccanceled})
    await tick()
    const sessionID = fake.calls[0]!.params.sessionID as number
    await expect(fake.push(choose, {devices}, {sessionID})).resolves.toEqual({error: inputCanceled})
    held[0]!.reply(undefined)
  })

  test('a prompt still on the listener timer is refused, never surfaced', async () => {
    const {dialog, fake, sessionID} = await startRecover()
    const {finished, seen} = collect(dialog.events)
    const pushed = fake.push(choose, {devices}, {sessionID})
    dialog.dispose()
    await expect(pushed).resolves.toEqual({error: inputCanceled})
    await afterTimers()
    await finished
    expect(seen).toEqual([])
    await settledError(dialog.done)
  })
})

describe('events', () => {
  test('a prompt that closed before it was read is skipped', async () => {
    const {dialog, fake, sessionID} = await startRecover()
    void fake.push(choose, {devices}, {sessionID})
    await afterTimers()
    fake.cancelPush(choose)
    await settledError(dialog.done)
    const {finished, seen} = collect(dialog.events)
    await finished
    expect(seen).toEqual([])
  })

  test('dispose drops events not yet read', async () => {
    const {dialog, fake, sessionID} = await startRecover()
    void fake.push(explain, {kind: T.RPCGen.DeviceType.mobile, name: 'phone'}, {sessionID})
    await afterTimers()
    dialog.dispose()
    const {finished, seen} = collect(dialog.events)
    await finished
    expect(seen).toEqual([])
    await settledError(dialog.done)
  })

  test('break disposes the dialog', async () => {
    const {dialog, fake, sessionID} = await startRecover()
    const pushed = fake.push(choose, {devices}, {sessionID})
    for await (const e of dialog.events) {
      expect(e.kind).toBe('prompt')
      break
    }
    expect(dialog.disposed).toBe(true)
    await expect(pushed).resolves.toEqual({error: inputCanceled})
    await settledError(dialog.done)
  })

  test('a second iteration throws', async () => {
    const {dialog} = await startRecover()
    dialog.events[Symbol.asyncIterator]()
    expect(() => dialog.events[Symbol.asyncIterator]()).toThrow()
    dialog.dispose()
    await settledError(dialog.done)
  })
})

test('waiting goes true, false while a prompt is up, and true again after the answer', async () => {
  const {dialog, fake, held, sessionID} = await startRecover()
  expect(waitingCount(fake)).toBe(1)
  const it = dialog.events[Symbol.asyncIterator]()
  void fake.push(choose, {devices}, {sessionID})
  const e = await nextEvent(it)
  if (e.kind !== 'prompt') throw new Error('expected a prompt')
  expect(waitingCount(fake)).toBe(0)
  e.answer('d1' as never)
  expect(waitingCount(fake)).toBe(1)
  held[0]!.reply(undefined)
  await dialog.done
  expect(waitingCount(fake)).toBe(0)
})

test('dispose while a prompt is up leaves waiting at 0', async () => {
  const {dialog, fake, held, sessionID} = await startRecover()
  const it = dialog.events[Symbol.asyncIterator]()
  void fake.push(choose, {devices}, {sessionID})
  await nextEvent(it)
  dialog.dispose()
  await settledError(dialog.done)
  expect(waitingCount(fake)).toBe(0)
  held[0]!.reply(undefined)
  await tick()
  expect(waitingCount(fake)).toBe(0)
})

test('an undeclared incoming call still fails the fake', async () => {
  const {dialog, fake, sessionID} = await startRecover()
  await fake.push('keybase.1.gpgUi.selectKey', {keys: []}, {sessionID})
  dialog.dispose()
  await settledError(dialog.done)
  expect(() => uninstallFakeEngine()).toThrow(/keybase.1.gpgUi.selectKey/)
})

describe('logout', () => {
  const startPgp = (fake: FakeEngine) => {
    fake.hold(pgpRpc)
    return openDialog(pgpRpc, {createUids: {useDefault: true}}, {prompts: [pushPrivate]})
  }

  test('disposes open dialogs except those whose RPC survives an account change', async () => {
    const {dialog: recover, fake, held} = await startRecover()
    const pgp = startPgp(fake)
    await tick()
    disposeDialogsForLogout()
    expect(pgp.disposed).toBe(true)
    expect(recover.disposed).toBe(false)
    await expect(settledError(pgp.done)).resolves.toMatchObject({code: T.RPCGen.StatusCode.sccanceled})
    held[0]!.reply(undefined)
    await expect(recover.done).resolves.toBeUndefined()
  })

  test('the config store disposes on a logout, refusing the open prompt', async () => {
    useConfigState.getState().dispatch.setLoggedIn(true)
    const fake = installFakeEngine()
    const pgp = startPgp(fake)
    await tick()
    const sessionID = fake.calls[0]!.params.sessionID as number
    const pushed = fake.push(pushPrivate, {prompt: true}, {sessionID})
    const it = pgp.events[Symbol.asyncIterator]()
    const e = await nextEvent(it)
    useConfigState.getState().dispatch.setLoggedIn(false)
    expect(pgp.disposed).toBe(true)
    await expect(pushed).resolves.toEqual({error: inputCanceled})
    await expect(e.closed).resolves.toBe('cancelled')
    await settledError(pgp.done)
  })

  test('the config store disposes non-surviving dialogs when an account switch starts', async () => {
    useConfigState.getState().dispatch.setLoggedIn(true)
    const {dialog: recover, fake} = await startRecover()
    const pgp = startPgp(fake)
    await tick()
    useConfigState.getState().dispatch.setUserSwitching(true, 'testuser-mac')
    expect(pgp.disposed).toBe(true)
    // The switch cancels every outstanding session, so the surviving dialog ends without disposing
    expect(recover.disposed).toBe(false)
    await expect(settledError(recover.done)).resolves.toMatchObject({code: T.RPCGen.StatusCode.sccanceled})
    await settledError(pgp.done)
  })

  test('an account switch refuses the prompts of a dialog it does not dispose', async () => {
    useConfigState.getState().dispatch.setLoggedIn(true)
    const {dialog, fake, sessionID} = await startRecover()
    const it = dialog.events[Symbol.asyncIterator]()
    const pushed = fake.push(choose, {devices}, {sessionID})
    const e = await nextEvent(it)
    if (e.kind !== 'prompt') throw new Error('expected a prompt')
    useConfigState.getState().dispatch.setUserSwitching(true, 'testuser-mac')
    await expect(pushed).resolves.toEqual({error: inputCanceled})
    await expect(e.closed).resolves.toBe('ended')
    await expect(settledError(dialog.done)).resolves.toMatchObject({code: T.RPCGen.StatusCode.sccanceled})
    await expect(fake.push(pinentry, {pinentry: {}, terminal: null}, {sessionID})).resolves.toEqual({
      error: inputCanceled,
    })
  })

  test('a dialog whose RPC already ended is not disposed', async () => {
    const fake = installFakeEngine()
    fake.answer(pgpRpc, () => undefined)
    const pgp = openDialog(pgpRpc, {createUids: {useDefault: true}}, {prompts: [pushPrivate]})
    await pgp.done
    disposeDialogsForLogout()
    expect(pgp.disposed).toBe(false)
  })
})
