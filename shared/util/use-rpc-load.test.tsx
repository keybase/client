/** @jest-environment jsdom */
/// <reference types="jest" />

import {afterEach, beforeEach, expect, jest, test} from '@jest/globals'
import {act, cleanup, renderHook} from '@testing-library/react'
import {useDaemonState} from '@/stores/daemon'
import {createCachedResourceCache} from './use-cached-resource'
import {useRPCLoad} from './use-rpc-load'

const flush = async () => {
  await act(async () => {
    await Promise.resolve()
  })
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  cleanup()
  useDaemonState.setState({handshakeState: 'loading'})
  jest.useRealTimers()
  jest.restoreAllMocks()
})

test('without cache: loads on mount and maps the result', async () => {
  const call = jest.fn(async (n: number) => {
    await Promise.resolve()
    return n * 2
  })
  const {result} = renderHook(() => useRPCLoad(call, [21], {map: r => `got:${r}`}))
  expect(result.current.loading).toBe(true)
  // useOnMountOnce fires the mount load via a 1ms setTimeout; advance fake timers past it.
  act(() => {
    jest.advanceTimersByTime(1)
  })
  await flush()
  expect(call).toHaveBeenCalledTimes(1)
  expect(result.current.data).toBe('got:42')
  expect(result.current.loaded).toBe(true)
})

test('cache: concurrent hooks share one in-flight rpc', async () => {
  const store = createCachedResourceCache<string, string | undefined>('', 'k')
  let resolveCall: ((n: number) => void) | undefined
  const call = jest.fn(
    async () =>
      new Promise<number>(resolve => {
        resolveCall = resolve
      })
  )
  const opts = {cache: {staleMs: 10_000, store}, key: 'k', map: (r: number) => `got:${r}`}
  const a = renderHook(() => useRPCLoad(call, [], opts))
  const b = renderHook(() => useRPCLoad(call, [], opts))
  await flush()
  expect(call).toHaveBeenCalledTimes(1)
  await act(async () => {
    resolveCall?.(7)
    await Promise.resolve()
  })
  expect(a.result.current.data).toBe('got:7')
  expect(b.result.current.data).toBe('got:7')
})

test('cache: fresh data serves without an rpc, stale refires', async () => {
  const store = createCachedResourceCache<string, string | undefined>('', 'k')
  const call = jest.fn(async () => {
    await Promise.resolve()
    return 1
  })
  const opts = {cache: {staleMs: 10_000, store}, key: 'k', map: (r: number) => `got:${r}`}
  const first = renderHook(() => useRPCLoad(call, [], opts))
  await flush()
  expect(call).toHaveBeenCalledTimes(1)
  first.unmount()

  // fresh: second mount seeds from cache, no rpc
  const second = renderHook(() => useRPCLoad(call, [], opts))
  expect(second.result.current.data).toBe('got:1')
  expect(second.result.current.loaded).toBe(true)
  await flush()
  expect(call).toHaveBeenCalledTimes(1)
  second.unmount()

  // stale: third mount refires
  act(() => {
    jest.advanceTimersByTime(11_000)
  })
  renderHook(() => useRPCLoad(call, [], opts))
  await flush()
  expect(call).toHaveBeenCalledTimes(2)
})

test('cache: reload() forces the rpc even when fresh', async () => {
  const store = createCachedResourceCache<string, string | undefined>('', 'k')
  const call = jest.fn(async () => {
    await Promise.resolve()
    return 1
  })
  const opts = {cache: {staleMs: 10_000, store}, key: 'k', map: (r: number) => `got:${r}`}
  const {result} = renderHook(() => useRPCLoad(call, [], opts))
  await flush()
  expect(call).toHaveBeenCalledTimes(1)
  act(() => {
    result.current.reload()
  })
  await flush()
  expect(call).toHaveBeenCalledTimes(2)
})

test('reloads when the daemon reconnects', async () => {
  act(() => {
    useDaemonState.setState({handshakeState: 'done'})
  })
  const call = jest.fn(async () => {
    await Promise.resolve()
    return 1
  })
  renderHook(() => useRPCLoad(call, [], {map: (r: number) => r}))
  // useOnMountOnce fires the mount load via a 1ms setTimeout; advance fake timers past it.
  act(() => {
    jest.advanceTimersByTime(1)
  })
  await flush()
  expect(call).toHaveBeenCalledTimes(1)
  act(() => {
    useDaemonState.setState({handshakeState: 'loading'})
  })
  act(() => {
    useDaemonState.setState({handshakeState: 'done'})
  })
  await flush()
  expect(call).toHaveBeenCalledTimes(2)
})

test('cache: reload() bypasses an orphaned in-flight request', async () => {
  const store = createCachedResourceCache<string, string | undefined>('', 'k')
  let resolveSecond: ((n: number) => void) | undefined
  const call = jest
    .fn<() => Promise<number>>()
    .mockImplementationOnce(async () => new Promise<number>(() => {}))
    .mockImplementationOnce(
      async () =>
        new Promise<number>(resolve => {
          resolveSecond = resolve
        })
    )
  const opts = {cache: {staleMs: 10_000, store}, key: 'k', map: (r: number) => `got:${r}`}
  const {result} = renderHook(() => useRPCLoad(call, [], opts))
  await flush()
  expect(call).toHaveBeenCalledTimes(1)
  expect(result.current.loading).toBe(true)

  act(() => {
    result.current.reload()
  })
  await flush()
  expect(call).toHaveBeenCalledTimes(2)

  await act(async () => {
    resolveSecond?.(9)
    await Promise.resolve()
  })
  expect(result.current.data).toBe('got:9')
})

test('cache: a rejected load surfaces the error to all sharers', async () => {
  const store = createCachedResourceCache<string, string | undefined>('', 'k')
  let rejectCall: ((error: Error) => void) | undefined
  const call = jest.fn(
    async () =>
      new Promise<number>((_resolve, reject) => {
        rejectCall = reject
      })
  )
  const onErrorA = jest.fn()
  const onErrorB = jest.fn()
  const opts = (onError: (e: unknown) => void) => ({
    cache: {staleMs: 10_000, store},
    key: 'k',
    map: (r: number) => `got:${r}`,
    onError,
  })
  const a = renderHook(() => useRPCLoad(call, [], opts(onErrorA)))
  const b = renderHook(() => useRPCLoad(call, [], opts(onErrorB)))
  await flush()
  expect(call).toHaveBeenCalledTimes(1)

  const error = new Error('boom')
  await act(async () => {
    rejectCall?.(error)
    await Promise.resolve()
  })
  expect(a.result.current.error).toBe(error)
  expect(b.result.current.error).toBe(error)
  expect(onErrorA).toHaveBeenCalledWith(error)
  expect(onErrorB).toHaveBeenCalledWith(error)
})
