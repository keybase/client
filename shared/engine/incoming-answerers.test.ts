/// <reference types="jest" />
import * as T from '@/constants/types'
import type * as EngineGen from '@/constants/rpc'
import {installFakeEngine, uninstallFakeEngine} from '@/test/fake-engine'
import {registerIncomingAnswerer} from './incoming-answerers'
import logger from '@/logger'

const unregisters = new Array<() => void>()
const register: typeof registerIncomingAnswerer = (method, answer, options) => {
  const unregister = registerIncomingAnswerer(method, answer, options)
  unregisters.push(unregister)
  return unregister
}

const dev = __DEV__
afterEach(() => {
  unregisters.splice(0).forEach(u => u())
  global.__DEV__ = dev
  jest.restoreAllMocks()
})

const pinentry = {pinentry: {}, terminal: null}

// The transport only logs a second settle, so a double answer shows up here
const watchErrors = () => jest.spyOn(logger, 'error').mockImplementation(() => {})

test('a registered answerer gets the call, answers it once, and the action carries no response', async () => {
  const logged = watchErrors()
  const order = new Array<string>()
  const answer = {passphrase: 'testpass', storeSecret: false}
  register('keybase.1.secretUi.getPassphrase', (params, response) => {
    order.push('answerer')
    expect(params).toMatchObject(pinentry)
    response.result(answer)
  })
  const onEngineIncoming = jest.fn((a: EngineGen.Actions) => {
    order.push('action')
    expect(a.payload).not.toHaveProperty('response')
  })
  const fake = installFakeEngine({onEngineIncoming})
  await expect(fake.push('keybase.1.secretUi.getPassphrase', pinentry, {sessionID: 0})).resolves.toEqual({
    result: answer,
  })
  expect(order).toEqual(['answerer', 'action'])
  expect(logged).not.toHaveBeenCalled()
  uninstallFakeEngine()
})

test('a must-answer call with no answerer is refused with scinputcanceled, never an empty success', async () => {
  global.__DEV__ = true
  const logged = watchErrors()
  const onEngineIncoming = jest.fn()
  const fake = installFakeEngine({onEngineIncoming})
  await expect(fake.push('keybase.1.secretUi.getPassphrase', pinentry, {sessionID: 0})).resolves.toEqual({
    error: {code: T.RPCGen.StatusCode.scinputcanceled, desc: 'No handler for keybase.1.secretUi.getPassphrase'},
  })
  expect(logged).toHaveBeenCalledTimes(1)
  expect(onEngineIncoming).toHaveBeenCalledTimes(1)
  expect(onEngineIncoming.mock.calls[0]![0].payload).not.toHaveProperty('response')
  uninstallFakeEngine()
})

test('after its answerer unregisters, a must-answer call is refused', async () => {
  const unregister = register('keybase.1.secretUi.getPassphrase', (_, response) => response.result({passphrase: '', storeSecret: false}))
  unregister()
  const fake = installFakeEngine()
  await expect(fake.push('keybase.1.secretUi.getPassphrase', pinentry, {sessionID: 0})).resolves.toMatchObject({
    error: {code: T.RPCGen.StatusCode.scinputcanceled},
  })
  uninstallFakeEngine()
})

test('a second answerer for one method is refused at registration', () => {
  register('keybase.1.secretUi.getPassphrase', () => {})
  expect(() => register('keybase.1.secretUi.getPassphrase', () => {})).toThrow(
    'An incoming answerer is already registered for keybase.1.secretUi.getPassphrase'
  )
})

test('a stale unregister leaves the current answerer in place', async () => {
  const stale = register('keybase.1.secretUi.getPassphrase', () => {})
  stale()
  const answer = {passphrase: 'testpass', storeSecret: false}
  register('keybase.1.secretUi.getPassphrase', (_, response) => response.result(answer))
  stale()
  const fake = installFakeEngine()
  await expect(fake.push('keybase.1.secretUi.getPassphrase', pinentry, {sessionID: 0})).resolves.toEqual({
    result: answer,
  })
  uninstallFakeEngine()
})

// A void custom call is safe to ack: Go reads nothing back from it. This is what keeps a rekey
// refresh with no session answered and dispatched.
test('a void custom call with no session is auto-answered once and dispatched without a response', async () => {
  const logged = watchErrors()
  const onEngineIncoming = jest.fn()
  const fake = installFakeEngine({onEngineIncoming})
  const params = {problemSetDevices: {devices: null, problemSet: {kid: '', tlfs: null, user: {uid: '', username: 'testuser'}}}}
  await expect(fake.push('keybase.1.rekeyUI.refresh', params, {sessionID: 0})).resolves.toEqual({result: undefined})
  expect(onEngineIncoming).toHaveBeenCalledTimes(1)
  expect(onEngineIncoming.mock.calls[0]![0]).toEqual({
    payload: {params: {...params, sessionID: 0}},
    type: 'keybase.1.rekeyUI.refresh',
  })
  expect(logged).not.toHaveBeenCalled()
  uninstallFakeEngine()
})

// Go reads the empty answer as session id 0, so later rekey calls carry no session and take the
// auto-answered path above, on every platform.
test('delegateRekeyUI is answered by the engine with no value', async () => {
  const onEngineIncoming = jest.fn()
  const fake = installFakeEngine({onEngineIncoming})
  await expect(fake.push('keybase.1.rekeyUI.delegateRekeyUI', {})).resolves.toEqual({result: undefined})
  expect(onEngineIncoming.mock.calls.map(c => c[0])).toEqual([
    {payload: {params: {}}, type: 'keybase.1.rekeyUI.delegateRekeyUI'},
  ])
  uninstallFakeEngine()
})

test('an answerer that throws is answered once with input canceled, and the action still dispatches', async () => {
  const logged = watchErrors()
  register('keybase.1.secretUi.getPassphrase', () => {
    throw new Error('answerer broke')
  })
  const onEngineIncoming = jest.fn()
  const fake = installFakeEngine({onEngineIncoming})
  await expect(fake.push('keybase.1.secretUi.getPassphrase', pinentry, {sessionID: 0})).resolves.toEqual({
    error: {code: T.RPCGen.StatusCode.scinputcanceled, desc: 'Input canceled'},
  })
  expect(onEngineIncoming).toHaveBeenCalledTimes(1)
  expect(logged).toHaveBeenCalledTimes(1)
  uninstallFakeEngine()
})

describe('a prompt a registered answerer holds', () => {
  const holdOne = (fake: ReturnType<typeof installFakeEngine>) => {
    const responses = new Array<{result: (r: T.RPCGen.GetPassphraseRes) => void}>()
    const onCancelled = jest.fn()
    register('keybase.1.secretUi.getPassphrase', (_, response) => void responses.push(response), {onCancelled})
    const pushed = fake.push('keybase.1.secretUi.getPassphrase', pinentry, {sessionID: 0})
    return {onCancelled, pushed, responses}
  }
  const answer = {passphrase: 'testpass', storeSecret: false}
  const afterTimers = async () => new Promise(resolve => setTimeout(resolve, 0))

  test('is dropped unanswered when the service cancels it, and its answerer is told', async () => {
    const fake = installFakeEngine()
    const {onCancelled, pushed, responses} = holdOne(fake)
    fake.cancelPush('keybase.1.secretUi.getPassphrase')
    await pushed
    expect(onCancelled).toHaveBeenCalledTimes(1)
    expect(onCancelled).toHaveBeenCalledWith(responses[0])
    responses[0]!.result(answer)
    // The fake records a write to a seqid it is no longer waiting on
    expect(() => uninstallFakeEngine()).not.toThrow()
  })

  test('is dropped unanswered when the link drops, and nothing reaches the next link', async () => {
    const fake = installFakeEngine()
    const {onCancelled, pushed, responses} = holdOne(fake)
    fake.drop()
    await pushed
    expect(onCancelled).toHaveBeenCalledTimes(1)
    responses[0]!.result(answer)
    fake.restart()
    await afterTimers()
    expect(() => uninstallFakeEngine()).not.toThrow()
  })

  test('is dropped unanswered when the engine resets', async () => {
    const fake = installFakeEngine()
    const {onCancelled, responses} = holdOne(fake)
    fake.engine.reset()
    expect(onCancelled).toHaveBeenCalledTimes(1)
    responses[0]!.result(answer)
    await afterTimers()
    expect(() => uninstallFakeEngine()).not.toThrow()
  })

  test('is not reported cancelled once its answerer answered', async () => {
    const fake = installFakeEngine()
    const {onCancelled, pushed, responses} = holdOne(fake)
    responses[0]!.result(answer)
    await expect(pushed).resolves.toEqual({result: answer})
    fake.drop()
    expect(onCancelled).not.toHaveBeenCalled()
    uninstallFakeEngine()
  })
})

test('a oneway rekeySendEvent with session 0 is dispatched', async () => {
  const onEngineIncoming = jest.fn()
  const fake = installFakeEngine({onEngineIncoming})
  await fake.push('keybase.1.rekeyUI.rekeySendEvent', {event: {eventType: 0}}, {oneway: true, sessionID: 0})
  expect(onEngineIncoming.mock.calls.map(c => c[0])).toEqual([
    {payload: {params: {event: {eventType: 0}, sessionID: 0}}, type: 'keybase.1.rekeyUI.rekeySendEvent'},
  ])
  uninstallFakeEngine()
})
