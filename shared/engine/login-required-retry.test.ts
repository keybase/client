/// <reference types="jest" />
// A call the service fails as login-required just after a login, while its session is still being
// set up, is tried again a bounded number of times while the app is logged in as the same user.
import * as T from '@/constants/types'
import {fakeError, installFakeEngine, uninstallFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {mayRetryLoginRequired} from './account-generation'
import {useConfigState} from '@/stores/config'
import {useWaitingState} from '@/stores/waiting'
import {resetAllStores} from '@/util/zustand'
import {testWaitingKey} from '@/test/waiting-key'

afterEach(() => {
  jest.useRealTimers()
  useConfigState.getState().dispatch.setUserSwitching(false)
  resetAllStores()
})

const settings = 'keybase.1.user.loadMySettings'
const waitingKey = testWaitingKey('login-required-retry-test')
const loginRequired = () => fakeError(T.RPCGen.StatusCode.scloginrequired, 'login required')
const byLoginRequired = {kind: {type: 'loginRequired'}}

const outcome = async (p: Promise<unknown>) =>
  p.then(
    r => ({r}),
    (e: unknown) => ({e})
  )
const count = (fake: FakeEngine) => {
  fake.engine._throttledDispatchWaitingAction.flush()
  return useWaitingState.getState().counts.get(waitingKey) ?? 0
}
const attempts = (fake: FakeEngine, method = settings) => fake.calls.filter(c => c.method === method).length

// The fake answers each attempt with the next reply, the last one from then on
const answering = (fake: FakeEngine, method: string, ...replies: Array<unknown>) => {
  let n = 0
  fake.answer(method, () => replies[Math.min(n++, replies.length - 1)])
}

const loggedIn = () => {
  jest.useFakeTimers({doNotFake: ['queueMicrotask']})
  useConfigState.getState().dispatch.setLoggedIn(true)
  return installFakeEngine()
}

test('a login-required failure while logged in is tried again, waiting all along', async () => {
  const fake = loggedIn()
  answering(fake, settings, loginRequired(), {})
  const p = outcome(T.RPCGen.userLoadMySettingsRpcPromise(undefined, waitingKey))
  await jest.advanceTimersByTimeAsync(249)
  expect(attempts(fake)).toBe(1)
  expect(count(fake)).toBe(1)
  await jest.advanceTimersByTimeAsync(1)
  expect(await p).toEqual({r: {}})
  expect(attempts(fake)).toBe(2)
  expect(count(fake)).toBe(0)
  uninstallFakeEngine()
})

test('after three login-required failures the caller gets the last one', async () => {
  const fake = loggedIn()
  answering(fake, settings, loginRequired())
  const p = outcome(T.RPCGen.userLoadMySettingsRpcPromise(undefined, waitingKey))
  await jest.advanceTimersByTimeAsync(250)
  expect(attempts(fake)).toBe(2)
  await jest.advanceTimersByTimeAsync(749)
  expect(attempts(fake)).toBe(2)
  expect(count(fake)).toBe(1)
  await jest.advanceTimersByTimeAsync(1)
  expect(await p).toEqual({e: expect.objectContaining(byLoginRequired)})
  expect(attempts(fake)).toBe(3)
  await jest.advanceTimersByTimeAsync(10_000)
  expect(attempts(fake)).toBe(3)
  expect(count(fake)).toBe(0)
  expect(useWaitingState.getState().errors.get(waitingKey)).toMatchObject(byLoginRequired)
  uninstallFakeEngine()
})

test('a logout while it waits to try again rejects it as the account change', async () => {
  const fake = loggedIn()
  answering(fake, settings, loginRequired(), {})
  const p = outcome(T.RPCGen.userLoadMySettingsRpcPromise(undefined, waitingKey))
  await jest.advanceTimersByTimeAsync(0)
  useConfigState.getState().dispatch.setLoggedIn(false)
  await jest.advanceTimersByTimeAsync(250)
  expect(await p).toEqual({e: expect.objectContaining({kind: {reason: 'accountChange', type: 'cancelled'}})})
  expect(attempts(fake)).toBe(1)
  expect(count(fake)).toBe(0)
  uninstallFakeEngine()
})

test('a cancel while it waits to try again rejects it and makes no more attempts', async () => {
  const fake = loggedIn()
  answering(fake, settings, loginRequired(), {})
  const p = outcome(T.RPCGen.userLoadMySettingsRpcPromise(undefined, waitingKey))
  await jest.advanceTimersByTimeAsync(0)
  fake.engine.cancelSession(fake.calls[0]!.params.sessionID as number)
  expect(await p).toEqual({e: expect.objectContaining({kind: {reason: 'caller', type: 'cancelled'}})})
  await jest.advanceTimersByTimeAsync(1_000)
  expect(attempts(fake)).toBe(1)
  expect(count(fake)).toBe(0)
  uninstallFakeEngine()
})

test('a lost link while it waits to try again rejects it as the lost link', async () => {
  const fake = loggedIn()
  answering(fake, settings, loginRequired(), {})
  const p = outcome(T.RPCGen.userLoadMySettingsRpcPromise(undefined, waitingKey))
  await jest.advanceTimersByTimeAsync(0)
  fake.drop()
  expect(await p).toEqual({e: expect.objectContaining({kind: {reason: 'disconnect', type: 'cancelled'}})})
  fake.restart()
  await jest.advanceTimersByTimeAsync(1_000)
  expect(attempts(fake)).toBe(1)
  uninstallFakeEngine()
})

test("a listener's call is not tried again: it may already have prompted the user", async () => {
  const fake = loggedIn()
  answering(fake, 'keybase.1.device.deviceAdd', loginRequired(), undefined)
  const p = outcome(
    T.RPCGen.deviceDeviceAddRpcListener({customResponseIncomingCallMap: {}, incomingCallMap: {}, params: undefined})
  )
  await jest.advanceTimersByTimeAsync(1_000)
  expect(await p).toEqual({e: expect.objectContaining(byLoginRequired)})
  expect(attempts(fake, 'keybase.1.device.deviceAdd')).toBe(1)
  uninstallFakeEngine()
})

test('a call that outlives the account is not tried again', async () => {
  const fake = loggedIn()
  answering(fake, 'keybase.1.login.getConfiguredAccounts', loginRequired(), [])
  const p = outcome(T.RPCGen.loginGetConfiguredAccountsRpcPromise())
  await jest.advanceTimersByTimeAsync(1_000)
  expect(await p).toEqual({e: expect.objectContaining(byLoginRequired)})
  expect(attempts(fake, 'keybase.1.login.getConfiguredAccounts')).toBe(1)
  uninstallFakeEngine()
})

test('logged out, a login-required failure is the answer', async () => {
  jest.useFakeTimers({doNotFake: ['queueMicrotask']})
  const fake = installFakeEngine()
  answering(fake, settings, loginRequired(), {})
  const p = outcome(T.RPCGen.userLoadMySettingsRpcPromise())
  await jest.advanceTimersByTimeAsync(1_000)
  expect(await p).toEqual({e: expect.objectContaining(byLoginRequired)})
  expect(attempts(fake)).toBe(1)
  uninstallFakeEngine()
})

test('another failure is not tried again', async () => {
  const fake = loggedIn()
  answering(fake, settings, fakeError(T.RPCGen.StatusCode.scgeneric, 'nope'), {})
  const p = outcome(T.RPCGen.userLoadMySettingsRpcPromise())
  await jest.advanceTimersByTimeAsync(1_000)
  expect(await p).toEqual({e: expect.objectContaining({code: T.RPCGen.StatusCode.scgeneric})})
  expect(attempts(fake)).toBe(1)
  uninstallFakeEngine()
})

test('only logged in, not switching, and on the same account may a call be tried again', () => {
  const {dispatch} = useConfigState.getState()
  expect(mayRetryLoginRequired(settings)).toBe(false)
  dispatch.setLoggedIn(true)
  expect(mayRetryLoginRequired(settings)).toBe(true)
  expect(mayRetryLoginRequired('keybase.1.login.getConfiguredAccounts')).toBe(false)
  // the switch's target landed, but the switch has not ended
  dispatch.setUserSwitching(true, 'testuser2')
  dispatch.setLoggedIn(true)
  expect(mayRetryLoginRequired(settings)).toBe(false)
  dispatch.setUserSwitching(false)
  expect(mayRetryLoginRequired(settings)).toBe(true)
  // a store reset logs the app out
  resetAllStores()
  expect(mayRetryLoginRequired(settings)).toBe(false)
})
