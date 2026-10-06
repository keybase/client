/// <reference types="jest" />
import * as T from '@/constants/types'
import {notifyEngineActionListeners} from '@/engine/action-listener'
import {RPCError} from '@/util/errors'
import {resetAllStores} from '@/util/zustand'
import {
  getProfileDetails,
  loadProfileIdentify,
  subscribeToProfile,
} from './identify-session'

const flush = async () => {
  for (let i = 0; i < 10; ++i) {
    await Promise.resolve()
  }
}

let identifySpy: jest.SpyInstance

beforeEach(() => {
  identifySpy = jest
    .spyOn(T.RPCGen, 'identify3Identify3RpcListener')
    .mockImplementation((async (p: {params: {guiID: string}}) => {
      // like the service, report a result before the call returns
      await Promise.resolve()
      notifyEngineActionListeners({
        payload: {params: {guiID: p.params.guiID, result: T.RPCGen.Identify3ResultType.ok}},
        type: 'keybase.1.identify3Ui.identify3Result',
      } as never)
    }) as never)
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

const minutes = (n: number) => n * 60_000
const mountOptions = {freshAfter: 0, ignoreCache: true, maxAgeMs: 30_000}

// Open a profile, let its identify finish with an ok result and one follower, and close it.
const openAndClose = async () => {
  jest
    .spyOn(T.RPCGen, 'userListTrackersUnverifiedRpcPromise')
    .mockImplementation(async () => Promise.resolve({users: [{fullName: '', username: 'testuser-mac'}]} as never))
  const unsub = subscribeToProfile('testuser', () => {})
  loadProfileIdentify('testuser', mountOptions)
  notifyEngineActionListeners({
    payload: {params: {guiID: getProfileDetails('testuser')?.guiID ?? '', result: T.RPCGen.Identify3ResultType.ok}},
    type: 'keybase.1.identify3Ui.identify3Result',
  } as never)
  await flush()
  unsub()
}

test('an idle session lets its result go once the last completed check expires', async () => {
  const now = Date.now()
  await openAndClose()
  expect(getProfileDetails('testuser')?.guiID).toBeTruthy()

  jest.spyOn(Date, 'now').mockReturnValue(now + minutes(6))
  expect(getProfileDetails('testuser')).toBeUndefined()
})

test('a profile reopened within the recheck window shows its last result without a new identify', async () => {
  await openAndClose()
  expect(identifySpy).toHaveBeenCalledTimes(1)

  const unsub = subscribeToProfile('testuser', () => {})
  loadProfileIdentify('testuser', mountOptions)
  await flush()

  expect(identifySpy).toHaveBeenCalledTimes(1)
  const details = getProfileDetails('testuser')
  expect(details?.followers).toEqual(new Set(['testuser-mac']))
  expect(details?.following).toEqual(new Set())
  expect(details?.guiID).toBeTruthy()
  expect(details?.state).toBe('valid')
  unsub()
})

test('a profile reopened after the recheck window runs a full load again', async () => {
  const now = Date.now()
  await openAndClose()

  jest.spyOn(Date, 'now').mockReturnValue(now + minutes(1))
  const unsubA = subscribeToProfile('testuser', () => {})
  loadProfileIdentify('testuser', mountOptions)
  expect(identifySpy).toHaveBeenCalledTimes(2)
  await flush()
  unsubA()

  jest.spyOn(Date, 'now').mockReturnValue(now + minutes(10))
  const unsubB = subscribeToProfile('testuser', () => {})
  loadProfileIdentify('testuser', mountOptions)
  expect(identifySpy).toHaveBeenCalledTimes(3)
  expect(getProfileDetails('testuser')?.state).toBe('checking')
  unsubB()
})

test('a tracking change to a closed profile makes its reopen check again', async () => {
  await openAndClose()
  notifyEngineActionListeners({
    payload: {params: {isTrackedByUs: true, uid: '', username: 'testuser'}},
    type: 'keybase.1.NotifyTracking.trackingChanged',
  } as never)

  const unsub = subscribeToProfile('testuser', () => {})
  loadProfileIdentify('testuser', mountOptions)
  expect(identifySpy).toHaveBeenCalledTimes(2)
  unsub()
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

const failNextIdentify = () =>
  identifySpy.mockImplementationOnce(async () =>
    // the engine rejects with an RPCError, which is not an Error subclass
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    Promise.reject(new RPCError('network', T.RPCGen.StatusCode.scgeneric))
  )

test('a failed identify does not count as a recent check', async () => {
  failNextIdentify()
  const unsubA = subscribeToProfile('testuser', () => {})
  loadProfileIdentify('testuser', mountOptions)
  await flush()
  unsubA()

  const unsubB = subscribeToProfile('testuser', () => {})
  loadProfileIdentify('testuser', mountOptions)
  expect(identifySpy).toHaveBeenCalledTimes(2)
  unsubB()
})

test('a failed reload drops the earlier recent check instead of reviving its session', async () => {
  await openAndClose()
  const unsubA = subscribeToProfile('testuser', () => {})
  failNextIdentify()
  loadProfileIdentify('testuser', {freshAfter: Infinity, ignoreCache: true})
  await flush()
  unsubA()

  const unsubB = subscribeToProfile('testuser', () => {})
  loadProfileIdentify('testuser', mountOptions)
  expect(identifySpy).toHaveBeenCalledTimes(3)
  unsubB()
})
