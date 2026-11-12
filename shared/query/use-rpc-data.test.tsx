/** @jest-environment jsdom */
/// <reference types="jest" />

import {afterEach, beforeEach, expect, jest, test} from '@jest/globals'
import {act, cleanup, renderHook} from '@testing-library/react'
import * as T from '@/constants/types'
import {notifyEngineActionListeners} from '@/engine/action-listener'
import {startNewAccountGeneration} from '@/engine/account-generation'
import {useConfigState} from '@/stores/config'
import {useDaemonState} from '@/stores/daemon'
import {useWaitingState} from '@/stores/waiting'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {flush} from '@/test/flush'
import {resetAllStores} from '@/util/zustand'
import {reuseEqual, stableKey} from './cache'
import {
  forgetLoad,
  loadRpcIfStale,
  refreshLoad,
  refreshRpc,
  setRpcData,
  useCachedRpcData,
  useLoadData,
  useRpcData,
} from '.'

const listMethod = 'keybase.1.device.deviceHistoryList'
const listRpc = T.RPCGen.deviceDeviceHistoryListRpcPromise
const waitingKey = 'devices:devicesPage' as const

const device = (name: string) => ({device: {deviceID: name, name}})
const toNames = (details: ReadonlyArray<T.RPCGen.DeviceDetail> | null) => details?.map(d => d.device.name) ?? []

let fake: FakeEngine

const useDevices = () => useRpcData(listRpc, undefined, {select: toNames, waitingKey})
const listCalls = () => fake.calls.filter(c => c.method === listMethod).length
const waitingCount = () => {
  fake.engine._throttledDispatchWaitingAction.flush()
  return useWaitingState.getState().counts.get(waitingKey) ?? 0
}
const notice = async () => {
  await fake.push('keybase.1.NotifyDeviceHistory.deviceHistoryChanged', {}, {oneway: true})
}

beforeEach(() => {
  fake = installFakeEngine({onEngineIncoming: notifyEngineActionListeners})
  useDaemonState.setState({handshakeState: 'done'})
})

afterEach(() => {
  cleanup()
  resetAllStores()
})

test('screens reading the same rpc share one call and one answer', async () => {
  fake.answer(listMethod, () => [device('laptop')])
  const a = renderHook(useDevices)
  const b = renderHook(useDevices)
  expect(a.result.current.loading).toBe(true)
  await flush()
  expect(a.result.current.data).toEqual(['laptop'])
  expect(a.result.current.data).toBe(b.result.current.data)
  expect(a.result.current.loading).toBe(false)
  expect(listCalls()).toBe(1)

  // a screen opened later paints from the cache at once, and reloads behind it
  fake.answer(listMethod, () => [device('laptop'), device('phone')])
  const c = renderHook(useDevices)
  expect(c.result.current.data).toEqual(['laptop'])
  await flush()
  expect(c.result.current.data).toEqual(['laptop', 'phone'])
  expect(a.result.current.data).toEqual(['laptop', 'phone'])
  expect(listCalls()).toBe(2)
})

test('a reload that brings back the same answer keeps the data’s identity', async () => {
  fake.answer(listMethod, () => [device('laptop')])
  const {result} = renderHook(useDevices)
  const raw = renderHook(() => useCachedRpcData(listRpc, undefined))
  await flush()
  const first = result.current.data
  const firstRaw = raw.result.current
  expect(firstRaw).toHaveLength(1)
  act(() => result.current.reload())
  await flush()
  expect(listCalls()).toBe(2)
  expect(result.current.data).toBe(first)
  expect(raw.result.current).toBe(firstRaw)
})

test('data inside staleMs is not reloaded by the next screen to mount', async () => {
  fake.answer(listMethod, () => [device('laptop')])
  const useFresh = () => useRpcData(listRpc, undefined, {staleMs: 60_000})
  renderHook(useFresh)
  await flush()
  renderHook(useFresh)
  await flush()
  expect(listCalls()).toBe(1)
})

test('a reader shows what a loader loads and never starts a load itself', async () => {
  fake.answer(listMethod, () => [device('laptop')])
  const reader = renderHook(() => useCachedRpcData(listRpc, undefined, toNames))
  await flush()
  expect(listCalls()).toBe(0)
  expect(reader.result.current).toBeUndefined()
  // nothing is loading it, so there is nothing to keep fresh
  await loadRpcIfStale(listRpc, undefined, 0)
  expect(listCalls()).toBe(0)

  renderHook(useDevices)
  await flush()
  expect(listCalls()).toBe(1)
  expect(reader.result.current).toEqual(['laptop'])

  // with a loader mounted it loads, and resolves only once the answer is in
  const held = fake.hold(listMethod)
  let settled = false
  let waiting = Promise.resolve()
  act(() => {
    waiting = (async () => {
      await loadRpcIfStale(listRpc, undefined, 0)
      settled = true
    })()
  })
  await flush()
  expect(held).toHaveLength(1)
  expect(settled).toBe(false)
  held[0]!.reply([device('laptop'), device('phone')])
  await act(async () => waiting)
  expect(settled).toBe(true)
  expect(reader.result.current).toEqual(['laptop', 'phone'])
})

test('a burst of change notices during a load costs one more load, which carries the change', async () => {
  const held = fake.hold(listMethod)
  const {result} = renderHook(useDevices)
  await flush()
  expect(held).toHaveLength(1)

  for (let i = 0; i < 5; i++) {
    await notice()
  }
  await flush()
  expect(held).toHaveLength(1)

  // the load from before the notices lands first, with the old list
  held[0]!.reply([device('laptop')])
  await flush()
  expect(held).toHaveLength(2)
  expect(result.current.loading).toBe(true)
  held[1]!.reply([device('laptop'), device('phone')])
  await flush()
  expect(result.current.data).toEqual(['laptop', 'phone'])
  expect(result.current.loading).toBe(false)
  expect(held).toHaveLength(2)
})

test('a notice for data no screen is showing loads nothing until a screen mounts', async () => {
  fake.answer(listMethod, () => [device('laptop')])
  const first = renderHook(() => useRpcData(listRpc, undefined, {staleMs: 60_000}))
  await flush()
  first.unmount()
  await notice()
  await flush()
  expect(listCalls()).toBe(1)

  // inside staleMs, but the notice made it stale
  renderHook(() => useRpcData(listRpc, undefined, {staleMs: 60_000}))
  await flush()
  expect(listCalls()).toBe(2)
})

test('a lost link shows no error, and the load goes out again after the reconnect handshake', async () => {
  const held = fake.hold(listMethod)
  const {result} = renderHook(useDevices)
  await flush()
  expect(held).toHaveLength(1)

  fake.drop()
  await flush()
  expect(result.current.error).toBeUndefined()
  expect(result.current.loading).toBe(true)

  fake.answer(listMethod, () => [device('laptop')])
  fake.restart()
  act(() => {
    useDaemonState.setState({handshakeState: 'loading'})
  })
  await flush()
  // the link is back but the handshake is not done: still waiting
  expect(listCalls()).toBe(1)
  act(() => {
    useDaemonState.setState({handshakeState: 'done'})
  })
  await flush()
  expect(result.current.data).toEqual(['laptop'])
  expect(result.current.loading).toBe(false)
  expect(listCalls()).toBe(2)
})

test('a failed load shows its error, and the next success clears it', async () => {
  const held = fake.hold(listMethod)
  const {result} = renderHook(useDevices)
  await flush()
  held[0]!.reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'nope'))
  await flush()
  expect((result.current.error as {desc?: string}).desc).toBe('nope')
  // the attempt is over, but there is no answer
  expect(result.current.settled).toBe(true)
  expect(result.current.loaded).toBe(false)
  expect(result.current.loading).toBe(false)
  expect(result.current.data).toBeUndefined()

  // a screen mounting right after does not reissue the failed load; an explicit reload does
  renderHook(useDevices)
  await flush()
  expect(held).toHaveLength(1)
  act(() => result.current.reload())
  await flush()
  held[1]!.reply([device('laptop')])
  await flush()
  expect(result.current.error).toBeUndefined()
  expect(result.current.data).toEqual(['laptop'])
})

test('an account change empties the cache and refuses the old account’s late answer', async () => {
  fake.answer(listMethod, () => [device('old-account-laptop')])
  const {result} = renderHook(useDevices)
  await flush()
  expect(result.current.data).toEqual(['old-account-laptop'])

  // a reload is on the wire when the account goes
  const held = fake.hold(listMethod)
  act(() => refreshRpc(listRpc))
  await flush()
  expect(held).toHaveLength(1)

  act(() => {
    startNewAccountGeneration()
    fake.engine.cancelOutstandingSessions()
  })
  await flush()
  expect(result.current.data).toBeUndefined()
  expect(result.current.error).toBeUndefined()

  held[0]!.reply([device('old-account-laptop')])
  await flush()
  expect(result.current.data).toBeUndefined()

  // the screen stayed mounted: it loads for the next account once that account is in
  fake.answer(listMethod, () => [device('new-account-phone')])
  act(() => {
    useConfigState.setState({loggedIn: true, userSwitching: false})
  })
  await flush()
  expect(result.current.data).toEqual(['new-account-phone'])
})

test('a load still on the wire when the last screen leaves finishes and is cached', async () => {
  const held = fake.hold(listMethod)
  const first = renderHook(() => useRpcData(listRpc, undefined, {select: toNames, staleMs: 60_000, waitingKey}))
  await flush()
  first.unmount()
  await flush()
  // the service is still doing the work
  expect(waitingCount()).toBe(1)

  held[0]!.reply([device('laptop')])
  await flush()
  expect(waitingCount()).toBe(0)
  const next = renderHook(() => useRpcData(listRpc, undefined, {select: toNames, staleMs: 60_000, waitingKey}))
  expect(next.result.current.data).toEqual(['laptop'])
  await flush()
  expect(held).toHaveLength(1)
})

test('a reload cut off by a lost link after its screen left does not leave the data loading', async () => {
  fake.answer(listMethod, () => [device('laptop')])
  const useFresh = () => useRpcData(listRpc, undefined, {select: toNames, staleMs: 60_000})
  const first = renderHook(useFresh)
  await flush()
  fake.hold(listMethod)
  act(() => first.result.current.reload())
  await flush()
  first.unmount()
  fake.drop()
  await flush()

  // fresh enough that this screen starts no load of its own
  const next = renderHook(useFresh)
  expect(next.result.current.data).toEqual(['laptop'])
  expect(next.result.current.loading).toBe(false)
})

test('a notice during a load no screen is waiting for keeps its answer stale', async () => {
  const held = fake.hold(listMethod)
  const useFresh = () => useRpcData(listRpc, undefined, {select: toNames, staleMs: 60_000})
  const first = renderHook(useFresh)
  await flush()
  first.unmount()
  await notice()
  held[0]!.reply([device('from-before-the-notice')])
  await flush()

  // inside staleMs, but the answer predates the change
  const next = renderHook(useFresh)
  await flush()
  expect(held).toHaveLength(2)
  held[1]!.reply([device('current')])
  await flush()
  expect(next.result.current.data).toEqual(['current'])
})

test('a failed reload leaves data a notice made stale still stale', async () => {
  fake.answer(listMethod, () => [device('laptop')])
  const useFresh = () => useRpcData(listRpc, undefined, {select: toNames, staleMs: 60_000})
  const first = renderHook(useFresh)
  await flush()
  const held = fake.hold(listMethod)
  await act(notice)
  await flush()
  held[0]!.reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'nope'))
  await flush()
  first.unmount()

  // past the failure backoff, a new screen reloads although the data is inside staleMs
  jest.useFakeTimers({doNotFake: ['setImmediate', 'queueMicrotask', 'nextTick'], now: Date.now() + 10_000})
  try {
    renderHook(useFresh)
    await flush()
    expect(held).toHaveLength(2)
  } finally {
    jest.useRealTimers()
  }
})

test('waiting on a load also waits for the one a notice queued behind it', async () => {
  fake.answer(listMethod, () => [device('laptop')])
  const {result} = renderHook(useDevices)
  await flush()

  const held = fake.hold(listMethod)
  let done = false
  let waiting = Promise.resolve()
  act(() => {
    waiting = (async () => {
      await result.current.reloadAndWait()
      done = true
    })()
  })
  await flush()
  await act(notice)
  held[0]!.reply([device('from-before-the-notice')])
  await flush()
  expect(held).toHaveLength(2)
  expect(done).toBe(false)
  held[1]!.reply([device('current')])
  await act(async () => waiting)
  expect(done).toBe(true)
  expect(result.current.data).toEqual(['current'])
})

test('data nothing has looked at for five minutes is dropped, with no new key needed', async () => {
  jest.useFakeTimers({doNotFake: ['setImmediate', 'queueMicrotask', 'nextTick']})
  try {
    fake.answer(listMethod, () => [device('laptop')])
    const useLongLived = () => useRpcData(listRpc, undefined, {select: toNames, staleMs: 60 * 60_000})
    const first = renderHook(useLongLived)
    await flush()
    first.unmount()

    act(() => {
      jest.advanceTimersByTime(4 * 60_000)
    })
    const stillCached = renderHook(useLongLived)
    expect(stillCached.result.current.data).toEqual(['laptop'])
    stillCached.unmount()

    act(() => {
      jest.advanceTimersByTime(11 * 60_000)
    })
    const held = fake.hold(listMethod)
    const next = renderHook(useLongLived)
    expect(next.result.current.data).toBeUndefined()
    await flush()
    expect(held).toHaveLength(1)
  } finally {
    jest.useRealTimers()
  }
})

test('a disabled instance is not loading while another screen loads the same data', async () => {
  fake.hold(listMethod)
  renderHook(useDevices)
  const disabled = renderHook(() => useRpcData(listRpc, undefined, {enabled: false}))
  await flush()
  expect(disabled.result.current.loading).toBe(false)
})

test('an optimistic write shows at once, and the reload after the save wins', async () => {
  const getRpc = T.RPCGen.accountGetLockdownModeRpcPromise
  let serverEnabled = false
  fake.answer('keybase.1.account.getLockdownMode', () => ({history: null, status: serverEnabled}))
  const {result} = renderHook(() => useRpcData(getRpc, undefined))
  await flush()
  expect(result.current.data?.status).toBe(false)

  act(() => setRpcData(getRpc, undefined, prev => (prev ? {...prev, status: true} : prev)))
  expect(result.current.data?.status).toBe(true)

  // the service refused the save: the reload puts back what it has
  act(() => refreshRpc(getRpc))
  await flush()
  expect(result.current.data?.status).toBe(false)

  serverEnabled = true
  act(() => refreshRpc(getRpc))
  await flush()
  expect(result.current.data?.status).toBe(true)
})

test('keys ignore field order and tell byte arrays apart', () => {
  expect(stableKey('m', {a: 1, b: {c: 2, d: 3}})).toBe(stableKey('m', {b: {d: 3, c: 2}, a: 1}))
  expect(stableKey('m', {id: new Uint8Array([1, 2])})).toBe(stableKey('m', {id: new Uint8Array([1, 2])}))
  expect(stableKey('m', {id: new Uint8Array([1, 2])})).not.toBe(stableKey('m', {id: new Uint8Array([1, 3])}))
  expect(stableKey('m', undefined)).not.toBe(stableKey('n', undefined))
})

test('reuseEqual keeps the identity of every part that did not change', () => {
  const prev = {bytes: new Uint8Array([1]), list: [{id: 1}, {id: 2}], name: 'a'}
  expect(reuseEqual(prev, {bytes: new Uint8Array([1]), list: [{id: 1}, {id: 2}], name: 'a'})).toBe(prev)
  const next = reuseEqual(prev, {bytes: new Uint8Array([1]), list: [{id: 1}, {id: 3}], name: 'a'})
  expect(next).not.toBe(prev)
  expect(next.list[0]).toBe(prev.list[0])
  expect(next.list[1]).not.toBe(prev.list[1])
  expect(next.bytes).toBe(prev.bytes)
})

test('an explicit reload drops the answer of the load already on the wire', async () => {
  const held = fake.hold(listMethod)
  const {result} = renderHook(useDevices)
  await flush()
  act(() => result.current.reload())
  await flush()
  expect(held).toHaveLength(2)

  held[1]!.reply([device('new')])
  await flush()
  held[0]!.reply([device('old')])
  await flush()
  expect(result.current.data).toEqual(['new'])
  expect(waitingCount()).toBe(0)
})

test('reloadAndWait resolves once the reload’s answer is in', async () => {
  fake.answer(listMethod, () => [device('laptop')])
  const {result} = renderHook(useDevices)
  await flush()

  const held = fake.hold(listMethod)
  let done = false
  let waiting = Promise.resolve()
  act(() => {
    waiting = (async () => {
      await result.current.reloadAndWait()
      done = true
    })()
  })
  await flush()
  expect(done).toBe(false)
  held[0]!.reply([device('phone')])
  await act(async () => waiting)
  expect(done).toBe(true)
  expect(result.current.data).toEqual(['phone'])
})

test('a disabled hook loads nothing and shows nothing, even with the data cached', async () => {
  fake.answer(listMethod, () => [device('laptop')])
  renderHook(useDevices)
  await flush()
  const {result, rerender} = renderHook(
    ({enabled}: {enabled: boolean}) => useRpcData(listRpc, undefined, {enabled, select: toNames, staleMs: 60_000}),
    {initialProps: {enabled: false}}
  )
  await flush()
  expect(result.current.data).toBeUndefined()
  expect(result.current.loaded).toBe(false)
  expect(result.current.loading).toBe(false)
  expect(listCalls()).toBe(1)

  rerender({enabled: true})
  expect(result.current.data).toEqual(['laptop'])
})

test('a refreshKey change reloads data older than staleMs, and leaves fresher data alone', async () => {
  fake.answer(listMethod, () => [device('laptop')])
  const always = renderHook(({k}: {k: number}) => useRpcData(listRpc, undefined, {refreshKey: k}), {
    initialProps: {k: 1},
  })
  await flush()
  expect(listCalls()).toBe(1)
  always.rerender({k: 2})
  await flush()
  expect(listCalls()).toBe(2)
  always.unmount()

  const fresh = renderHook(
    ({k}: {k: number}) => useRpcData(listRpc, undefined, {refreshKey: k, staleMs: 60_000}),
    {initialProps: {k: 1}}
  )
  await flush()
  fresh.rerender({k: 2})
  await flush()
  expect(listCalls()).toBe(2)
})

test('data that is not kept is gone once the last screen loading it leaves', async () => {
  fake.answer(listMethod, () => [device('laptop')])
  const useOnce = () => useRpcData(listRpc, undefined, {keep: false, select: toNames})
  const first = renderHook(useOnce)
  await flush()
  expect(first.result.current.data).toEqual(['laptop'])
  const loadCount = first.result.current.loadCount
  first.unmount()

  const held = fake.hold(listMethod)
  const second = renderHook(useOnce)
  expect(second.result.current.data).toBeUndefined()
  // the count goes on, so a screen that stayed up would know the next load from the last
  expect(second.result.current.loadCount).toBe(loadCount)
  await flush()
  held[0]!.reply([device('phone')])
  await flush()
  expect(second.result.current.data).toEqual(['phone'])
})

// a load made of more than one call, as the team screens have
const teamMethod = 'keybase.1.teams.getAnnotatedTeam'
const useTeamName = (teamID: string, suffix: string) =>
  useLoadData(
    'test.teamName',
    teamID,
    async signal => {
      const team = await T.RPCGen.teamsGetAnnotatedTeamRpcPromise({teamID}, undefined, signal)
      return `${team.name}${suffix}`
    },
    {staleMs: 60_000}
  )

test('a multi-call load is shared by key, reloaded or forgotten by key, and uses the latest load', async () => {
  fake.answer(teamMethod, (params: {teamID: string}) => ({name: `name-of-${params.teamID}`}))
  const a = renderHook(({suffix}: {suffix: string}) => useTeamName('team-a', suffix), {initialProps: {suffix: ''}})
  const again = renderHook(() => useTeamName('team-a', ''))
  const b = renderHook(() => useTeamName('team-b', ''))
  await flush()
  expect(a.result.current.data).toBe('name-of-team-a')
  expect(again.result.current.data).toBe('name-of-team-a')
  expect(b.result.current.data).toBe('name-of-team-b')
  expect(fake.calls.filter(c => c.method === teamMethod)).toHaveLength(2)

  // the screen's props moved on: the next load is made with what it closes over now
  a.rerender({suffix: '!'})
  act(() => refreshLoad('test.teamName', 'team-a'))
  await flush()
  expect(a.result.current.data).toBe('name-of-team-a!')
  expect(b.result.current.data).toBe('name-of-team-b')
  expect(fake.calls.filter(c => c.method === teamMethod)).toHaveLength(3)

  act(() => forgetLoad('test.teamName', 'team-b'))
  expect(b.result.current.data).toBeUndefined()
  expect(b.result.current.loaded).toBe(false)
  // gone, not about to load: no spinner that never ends
  expect(b.result.current.loading).toBe(false)
  await flush()
  expect(fake.calls.filter(c => c.method === teamMethod)).toHaveLength(3)
  expect(a.result.current.data).toBe('name-of-team-a!')
})

test('reuseEqual keeps Maps and Sets that did not change, and the entries of ones that did', () => {
  const prev = {byID: new Map([['a', {n: 1}], ['b', {n: 2}]]), tags: new Set(['x', 'y'])}
  expect(reuseEqual(prev, {byID: new Map([['a', {n: 1}], ['b', {n: 2}]]), tags: new Set(['y', 'x'])})).toBe(prev)
  const next = reuseEqual(prev, {byID: new Map([['a', {n: 1}], ['b', {n: 3}]]), tags: new Set(['x'])})
  expect(next.byID).not.toBe(prev.byID)
  expect(next.byID.get('a')).toBe(prev.byID.get('a'))
  expect(next.byID.get('b')).toEqual({n: 3})
  expect(next.tags).not.toBe(prev.tags)
})

test('an optimistic write beats a load that was already on the wire', async () => {
  const getRpc = T.RPCGen.accountGetLockdownModeRpcPromise
  fake.answer('keybase.1.account.getLockdownMode', () => ({history: null, status: false}))
  const {result} = renderHook(() => useRpcData(getRpc, undefined))
  await flush()

  const held = fake.hold('keybase.1.account.getLockdownMode')
  act(() => result.current.reload())
  await flush()
  act(() => setRpcData(getRpc, undefined, prev => (prev ? {...prev, status: true} : prev)))
  expect(result.current.loading).toBe(false)
  // the answer from before the write
  held[0]!.reply({history: null, status: false})
  await flush()
  expect(result.current.data?.status).toBe(true)
})

test('one notice heard by several listeners is one load, and the next notice is one more', async () => {
  fake.answer(listMethod, () => [device('laptop')])
  renderHook(useDevices)
  await flush()
  const held = fake.hold(listMethod)

  // as every mounted screen's own listener does for one notice from the service
  act(() => {
    refreshRpc(listRpc)
    refreshRpc(listRpc)
    refreshRpc(listRpc)
  })
  await flush()
  expect(held).toHaveLength(1)
  held[0]!.reply([device('laptop')])
  await flush()
  expect(held).toHaveLength(1)

  act(() => refreshRpc(listRpc))
  await flush()
  act(() => refreshRpc(listRpc))
  await flush()
  held[1]!.reply([device('laptop')])
  await flush()
  expect(held).toHaveLength(3)
})

test('debounced notices reload at once for the first, then once more after they stop', async () => {
  jest.useFakeTimers({doNotFake: ['setImmediate', 'queueMicrotask', 'nextTick']})
  try {
    fake.answer(listMethod, () => [device('laptop')])
    renderHook(useDevices)
    await flush()
    expect(listCalls()).toBe(1)

    for (let i = 0; i < 6; i++) {
      act(() => refreshRpc(listRpc, 2000))
      await flush()
      act(() => {
        jest.advanceTimersByTime(1000)
      })
      await flush()
    }
    // the first, and nothing while they kept coming a second apart
    expect(listCalls()).toBe(2)
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    await flush()
    expect(listCalls()).toBe(3)
    act(() => {
      jest.advanceTimersByTime(10_000)
    })
    await flush()
    expect(listCalls()).toBe(3)
  } finally {
    jest.useRealTimers()
  }
})

test('a failed load is reported once, however many screens show it', async () => {
  const held = fake.hold(listMethod)
  const errors: Array<string> = []
  const onError = (e: Error) => {
    errors.push(e.message)
  }
  const useReporting = () => useRpcData(listRpc, undefined, {onError})
  renderHook(useReporting)
  renderHook(useReporting)
  await flush()
  held[0]!.reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'nope'))
  await flush()
  expect(errors).toHaveLength(1)
  // a screen opened onto the cached failure does not report it again
  renderHook(useReporting)
  await flush()
  expect(errors).toHaveLength(1)
})

test('what failed while logged out loads once the account is in', async () => {
  const held = fake.hold(listMethod)
  const {result} = renderHook(useDevices)
  await flush()
  held[0]!.reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'not logged in'))
  await flush()
  expect(result.current.error).toBeDefined()

  fake.answer(listMethod, () => [device('laptop')])
  act(() => {
    useConfigState.setState({loggedIn: false})
  })
  act(() => {
    useConfigState.setState({loggedIn: true, userSwitching: false})
  })
  await flush()
  expect(result.current.data).toEqual(['laptop'])
  expect(result.current.error).toBeUndefined()
})
