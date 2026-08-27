/// <reference types="jest" />
import * as T from '@/constants/types'
import {notifyEngineActionListeners} from '@/engine/action-listener'
import {resetAllStores} from '@/util/zustand'
import {
  getProfileDetails,
  loadProfileIdentify,
  subscribeToProfile,
} from './identify-session'

const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

let identifySpy: jest.SpyInstance

beforeEach(() => {
  identifySpy = jest
    .spyOn(T.RPCGen, 'identify3Identify3RpcListener')
    .mockImplementation(async () => Promise.resolve() as unknown as Promise<never>)
  jest
    .spyOn(T.RPCGen, 'userListTrackersUnverifiedRpcPromise')
    .mockImplementation(async () => Promise.resolve({users: []} as never))
  jest
    .spyOn(T.RPCGen, 'userListTrackingRpcPromise')
    .mockImplementation(async () => Promise.resolve({users: []} as never))
})

afterEach(() => {
  jest.restoreAllMocks()
  resetAllStores()
})

test('one session serves every spelling of the same username', () => {
  const unsub = subscribeToProfile('TestUser', () => {})
  loadProfileIdentify('testuser', {freshAfter: 0, ignoreCache: true})
  loadProfileIdentify('TESTUSER', {freshAfter: 0, ignoreCache: true})

  expect(identifySpy).toHaveBeenCalledTimes(1)
  expect(identifySpy).toHaveBeenCalledWith(expect.objectContaining({params: expect.objectContaining({assertion: 'testuser'})}))
  expect(getProfileDetails('TestUser')).toBe(getProfileDetails('testuser'))
  unsub()
})

test('a second caller joins an in-flight identify instead of starting its own', () => {
  const unsub = subscribeToProfile('testuser', () => {})
  loadProfileIdentify('testuser', {freshAfter: 0, ignoreCache: true})
  loadProfileIdentify('testuser', {freshAfter: 0, ignoreCache: true})
  loadProfileIdentify('testuser', {freshAfter: 0, ignoreCache: false})

  expect(identifySpy).toHaveBeenCalledTimes(1)
  unsub()
})

test('a forced check does not join an in-flight identify that used the cache', () => {
  const unsub = subscribeToProfile('testuser', () => {})
  loadProfileIdentify('testuser', {freshAfter: 0, ignoreCache: false})
  expect(identifySpy).toHaveBeenCalledTimes(1)

  // the cached identify is not strong enough for a caller that wants a remote check
  loadProfileIdentify('testuser', {freshAfter: 0, ignoreCache: true})
  expect(identifySpy).toHaveBeenCalledTimes(2)
  expect(identifySpy).toHaveBeenLastCalledWith(
    expect.objectContaining({params: expect.objectContaining({ignoreCache: true})})
  )
  unsub()
})

test('freshAfter Infinity never joins an identify that is already running', () => {
  const unsub = subscribeToProfile('testuser', () => {})
  loadProfileIdentify('testuser', {freshAfter: 0, ignoreCache: true})
  loadProfileIdentify('testuser', {freshAfter: Infinity, ignoreCache: true})

  expect(identifySpy).toHaveBeenCalledTimes(2)
  unsub()
})

test('maxAgeMs suppresses a repeat identify right after one finished', async () => {
  const unsub = subscribeToProfile('testuser', () => {})
  loadProfileIdentify('testuser', {freshAfter: 0, ignoreCache: true})
  await flush()
  expect(identifySpy).toHaveBeenCalledTimes(1)

  loadProfileIdentify('testuser', {freshAfter: 0, ignoreCache: true, maxAgeMs: 30_000})
  expect(identifySpy).toHaveBeenCalledTimes(1)

  // an explicit reload passes no maxAgeMs and always runs
  loadProfileIdentify('testuser', {freshAfter: Infinity, ignoreCache: true})
  expect(identifySpy).toHaveBeenCalledTimes(2)
  unsub()
})

test('a finished cached identify does not satisfy a caller that wants a forced one', async () => {
  const unsub = subscribeToProfile('testuser', () => {})
  loadProfileIdentify('testuser', {freshAfter: 0, ignoreCache: false})
  await flush()

  loadProfileIdentify('testuser', {freshAfter: 0, ignoreCache: true, maxAgeMs: 30_000})
  expect(identifySpy).toHaveBeenCalledTimes(2)

  await flush()
  // ... but the forced one that just finished does satisfy a cached caller
  loadProfileIdentify('testuser', {freshAfter: 0, ignoreCache: false, maxAgeMs: 30_000})
  expect(identifySpy).toHaveBeenCalledTimes(2)
  unsub()
})

test('an empty username is ignored', () => {
  loadProfileIdentify('', {freshAfter: 0, ignoreCache: true})
  expect(identifySpy).not.toHaveBeenCalled()
})

test('starting an identify moves the details into the checking state and clears the old reason', () => {
  const unsub = subscribeToProfile('testuser', () => {})
  loadProfileIdentify('testuser', {freshAfter: 0, ignoreCache: true})

  const details = getProfileDetails('testuser')
  expect(details?.state).toBe('checking')
  expect(details?.reason).toBe('')
  expect(details?.guiID).toBeTruthy()
  unsub()
})

test('identify3 events are routed to the session that owns the guiID', () => {
  const unsubA = subscribeToProfile('testuser', () => {})
  const unsubB = subscribeToProfile('testuser-mac', () => {})
  loadProfileIdentify('testuser', {freshAfter: 0, ignoreCache: true})
  loadProfileIdentify('testuser-mac', {freshAfter: 0, ignoreCache: true})

  const guiID = getProfileDetails('testuser')?.guiID ?? ''
  expect(guiID).toBeTruthy()

  notifyEngineActionListeners({
    payload: {params: {guiID, result: T.RPCGen.Identify3ResultType.broken}},
    type: 'keybase.1.identify3Ui.identify3Result',
  } as never)

  expect(getProfileDetails('testuser')?.state).toBe('broken')
  expect(getProfileDetails('testuser-mac')?.state).toBe('checking')
  unsubA()
  unsubB()
})

test('subscribers are notified when their session details change', () => {
  const cb = jest.fn()
  const unsub = subscribeToProfile('testuser', cb)
  loadProfileIdentify('testuser', {freshAfter: 0, ignoreCache: true})
  expect(cb).toHaveBeenCalledTimes(1)

  const guiID = getProfileDetails('testuser')?.guiID ?? ''
  notifyEngineActionListeners({
    payload: {params: {guiID, result: T.RPCGen.Identify3ResultType.ok}},
    type: 'keybase.1.identify3Ui.identify3Result',
  } as never)
  expect(cb).toHaveBeenCalledTimes(2)

  unsub()
  notifyEngineActionListeners({
    payload: {params: {guiID, result: T.RPCGen.Identify3ResultType.broken}},
    type: 'keybase.1.identify3Ui.identify3Result',
  } as never)
  expect(cb).toHaveBeenCalledTimes(2)
})

test('an idle session is dropped once its last subscriber leaves and its identify finished', async () => {
  const unsub = subscribeToProfile('testuser', () => {})
  loadProfileIdentify('testuser', {freshAfter: 0, ignoreCache: true})
  await flush()

  expect(getProfileDetails('testuser')).toBeDefined()
  unsub()
  expect(getProfileDetails('testuser')).toBeUndefined()
})

test('a session with an identify still running is kept even with no subscribers', () => {
  const unsub = subscribeToProfile('testuser', () => {})
  loadProfileIdentify('testuser', {freshAfter: 0, ignoreCache: true})
  unsub()

  expect(getProfileDetails('testuser')?.state).toBe('checking')
})

test('a user reset notification is applied to the right session', () => {
  const unsub = subscribeToProfile('testuser', () => {})
  loadProfileIdentify('testuser', {freshAfter: 0, ignoreCache: true})
  const guiID = getProfileDetails('testuser')?.guiID ?? ''

  notifyEngineActionListeners({
    payload: {params: {guiID}},
    type: 'keybase.1.identify3Ui.identify3UserReset',
  } as never)

  expect(getProfileDetails('testuser')?.resetBrokeTrack).toBe(true)
  expect(getProfileDetails('testuser')?.reason).toContain('reset their account')
  unsub()
})

test('events for an unknown guiID are dropped', () => {
  const unsub = subscribeToProfile('testuser', () => {})
  loadProfileIdentify('testuser', {freshAfter: 0, ignoreCache: true})

  notifyEngineActionListeners({
    payload: {params: {guiID: 'not-a-real-gui-id', result: T.RPCGen.Identify3ResultType.broken}},
    type: 'keybase.1.identify3Ui.identify3Result',
  } as never)

  expect(getProfileDetails('testuser')?.state).toBe('checking')
  unsub()
})
