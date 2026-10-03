/** @jest-environment jsdom */
/// <reference types="jest" />

import type * as React from 'react'
import {afterEach, beforeEach, expect, jest, test} from '@jest/globals'
import {act, cleanup, renderHook} from '@testing-library/react'
import {NavigationContext} from '@react-navigation/core'
import {useDaemonState} from '@/stores/daemon'
import {useRPCLoad} from './use-rpc-load'
import * as T from '@/constants/types'
import {RPCError, type CancelReason} from './errors'

const flush = async () => {
  await act(async () => {
    await Promise.resolve()
  })
}

// enough of a navigation object for useSafeFocusEffect, which no-ops entirely
// without one, so when: 'focus' is unobservable outside a navigator
const makeNav = () => {
  const listeners = new Map<string, Set<() => void>>()
  const nav = {
    addListener: (event: string, cb: () => void) => {
      const set = listeners.get(event) ?? new Set()
      set.add(cb)
      listeners.set(event, set)
      return () => set.delete(cb)
    },
    isFocused: () => true,
  }
  const emit = (event: 'blur' | 'focus') => {
    act(() => {
      listeners.get(event)?.forEach(cb => cb())
    })
  }
  const wrapper = ({children}: {children: React.ReactNode}) => (
    <NavigationContext value={nav as never}>{children}</NavigationContext>
  )
  return {emit, wrapper}
}

const advancePastMountLoad = () => {
  // useOnMountOnce fires the mount load via a 1ms setTimeout
  act(() => {
    jest.advanceTimersByTime(1)
  })
}

const reconnect = () => {
  act(() => {
    useDaemonState.setState({handshakeState: 'loading'})
  })
  act(() => {
    useDaemonState.setState({handshakeState: 'done'})
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

test('loads on mount and maps the result', async () => {
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

test('reload() supersedes an in-flight request', async () => {
  let resolveFirst: ((n: number) => void) | undefined
  let resolveSecond: ((n: number) => void) | undefined
  const call = jest
    .fn<() => Promise<number>>()
    .mockImplementationOnce(
      async () =>
        new Promise<number>(resolve => {
          resolveFirst = resolve
        })
    )
    .mockImplementationOnce(
      async () =>
        new Promise<number>(resolve => {
          resolveSecond = resolve
        })
    )
  const {result} = renderHook(() => useRPCLoad(call, [], {map: (r: number) => `got:${r}`}))
  act(() => {
    jest.advanceTimersByTime(1)
  })
  await flush()
  expect(call).toHaveBeenCalledTimes(1)

  act(() => {
    result.current.reload()
  })
  await flush()
  expect(call).toHaveBeenCalledTimes(2)

  // the superseded request settling last must not win
  await act(async () => {
    resolveSecond?.(9)
    resolveFirst?.(1)
    await Promise.resolve()
  })
  expect(result.current.data).toBe('got:9')
})

test('surfaces a rejected load as an error', async () => {
  let rejectCall: ((error: Error) => void) | undefined
  const call = jest.fn(
    async () =>
      new Promise<number>((_resolve, reject) => {
        rejectCall = reject
      })
  )
  const onError = jest.fn()
  const {result} = renderHook(() =>
    useRPCLoad(call, [], {map: (r: number) => `got:${r}`, onError})
  )
  act(() => {
    jest.advanceTimersByTime(1)
  })
  await flush()
  expect(call).toHaveBeenCalledTimes(1)

  const error = new Error('boom')
  await act(async () => {
    rejectCall?.(error)
    await Promise.resolve()
  })
  expect(result.current.error).toBe(error)
  expect(onError).toHaveBeenCalledWith(error)
})

test("when: 'focus' loads on every focus, not on mount", async () => {
  const {emit, wrapper} = makeNav()
  const call = jest.fn(async () => Promise.resolve(1))
  renderHook(() => useRPCLoad(call, [], {map: (r: number) => r, when: 'focus'}), {wrapper})
  // the initial focus runs the effect body directly, no mount timer involved
  await flush()
  expect(call).toHaveBeenCalledTimes(1)

  advancePastMountLoad()
  await flush()
  expect(call).toHaveBeenCalledTimes(1)

  emit('blur')
  emit('focus')
  await flush()
  expect(call).toHaveBeenCalledTimes(2)
})

test("when: 'manual' does not load on mount, focus, or reconnect", async () => {
  act(() => {
    useDaemonState.setState({handshakeState: 'done'})
  })
  const {emit, wrapper} = makeNav()
  const call = jest.fn(async () => Promise.resolve(1))
  const {result} = renderHook(() => useRPCLoad(call, [], {map: (r: number) => r, when: 'manual'}), {wrapper})
  advancePastMountLoad()
  await flush()
  expect(call).not.toHaveBeenCalled()

  emit('blur')
  emit('focus')
  await flush()
  expect(call).not.toHaveBeenCalled()

  reconnect()
  await flush()
  expect(call).not.toHaveBeenCalled()

  // reload() is the only trigger left, and it ignores `when`
  act(() => {
    result.current.reload()
  })
  await flush()
  expect(call).toHaveBeenCalledTimes(1)
})

test("when: 'manual' with a key does not refire when the key changes", async () => {
  const call = jest.fn(async () => Promise.resolve(1))
  const {rerender} = renderHook(
    ({key}: {key: string}) => useRPCLoad(call, [], {key, map: (r: number) => r, when: 'manual'}),
    {initialProps: {key: 'a'}}
  )
  advancePastMountLoad()
  await flush()
  expect(call).not.toHaveBeenCalled()

  rerender({key: 'b'})
  await flush()
  expect(call).not.toHaveBeenCalled()
})

test('enabled: false skips the mount, key and reconnect loads but not reload()', async () => {
  act(() => {
    useDaemonState.setState({handshakeState: 'done'})
  })
  const call = jest.fn(async () => Promise.resolve(1))
  const {rerender, result} = renderHook(
    ({key}: {key: string}) => useRPCLoad(call, [], {enabled: false, key, map: (r: number) => r}),
    {initialProps: {key: 'a'}}
  )
  advancePastMountLoad()
  await flush()
  expect(call).not.toHaveBeenCalled()

  rerender({key: 'b'})
  await flush()
  expect(call).not.toHaveBeenCalled()

  reconnect()
  await flush()
  expect(call).not.toHaveBeenCalled()

  // documented: reload() ignores enabled
  act(() => {
    result.current.reload()
  })
  await flush()
  expect(call).toHaveBeenCalledTimes(1)
})

test('setData survives until the next load lands', async () => {
  let resolveCall: ((n: number) => void) | undefined
  const call = jest.fn(
    async () =>
      await new Promise<number>(resolve => {
        resolveCall = resolve
      })
  )
  const {result} = renderHook(() => useRPCLoad(call, [], {map: (r: number) => `got:${r}`}))
  advancePastMountLoad()
  await flush()
  act(() => {
    resolveCall?.(1)
  })
  await flush()
  expect(result.current.data).toBe('got:1')

  act(() => {
    result.current.setData(prev => `${prev}+local`)
  })
  expect(result.current.data).toBe('got:1+local')

  act(() => {
    result.current.reload()
  })
  await flush()
  expect(result.current.data).toBe('got:1+local')

  // the load result wins once it lands
  act(() => {
    resolveCall?.(2)
  })
  await flush()
  expect(result.current.data).toBe('got:2')
})

const cancelledBy = (reason: CancelReason) =>
  new RPCError('cancelled', T.RPCGen.StatusCode.sccanceled, null, undefined, undefined, {reason, type: 'cancelled'})

// Only a lost link waits, for the reconnect's reload; any other cancel ends the load quietly
test.each([
  ['caller', false],
  ['accountChange', false],
  ['service', false],
  ['disconnect', true],
] as const)('a load cancelled by %s is not an error (still loading: %s)', async (reason, loading) => {
  const call = jest.fn<() => Promise<number>>().mockRejectedValue(cancelledBy(reason))
  const onError = jest.fn()
  const {result} = renderHook(() => useRPCLoad(call, [], {map: (r: number) => r, onError}))
  advancePastMountLoad()
  await flush()
  expect(call).toHaveBeenCalledTimes(1)
  expect(result.current.error).toBeUndefined()
  expect(onError).not.toHaveBeenCalled()
  expect(result.current.loading).toBe(loading)
  expect(result.current.loaded).toBe(!loading)
})

test.each([
  ['caller', false],
  ['service', false],
  ['disconnect', true],
] as const)('a keyed load cancelled by %s (still loading: %s)', async (reason, loading) => {
  const call = jest.fn<() => Promise<number>>().mockRejectedValue(cancelledBy(reason))
  const {result} = renderHook(() => useRPCLoad(call, [], {key: 'k', map: (r: number) => r}))
  await flush()
  expect(call).toHaveBeenCalledTimes(1)
  expect(result.current.error).toBeUndefined()
  expect(result.current.loading).toBe(loading)
})

test('a load cancelled by a lost link loads again on reconnect', async () => {
  const call = jest
    .fn<() => Promise<number>>()
    .mockRejectedValueOnce(cancelledBy('disconnect'))
    .mockResolvedValue(7)
  useDaemonState.setState({handshakeState: 'done'})
  const {result} = renderHook(() => useRPCLoad(call, [], {map: (r: number) => r}))
  advancePastMountLoad()
  await flush()
  expect(result.current.loading).toBe(true)
  reconnect()
  await flush()
  expect(call).toHaveBeenCalledTimes(2)
  expect(result.current.data).toBe(7)
  expect(result.current.loading).toBe(false)
})

test("the service's own error still surfaces", async () => {
  const error = new RPCError('nope', T.RPCGen.StatusCode.scgeneric)
  const call = jest.fn<() => Promise<number>>().mockRejectedValue(error)
  const onError = jest.fn()
  const {result} = renderHook(() => useRPCLoad(call, [], {map: (r: number) => r, onError}))
  advancePastMountLoad()
  await flush()
  expect(result.current.error).toBe(error)
  expect(onError).toHaveBeenCalledWith(error)
})

test('a local failure fails the load', async () => {
  const error = new RPCError('write failed', 101, null, 'EOF', undefined, {type: 'local'})
  const call = jest.fn<() => Promise<number>>().mockRejectedValue(error)
  const {result} = renderHook(() => useRPCLoad(call, [], {map: (r: number) => r}))
  advancePastMountLoad()
  await flush()
  expect(result.current.error).toBe(error)
  expect(result.current.loading).toBe(false)
})
