/** @jest-environment jsdom */
/// <reference types="jest" />

import {afterEach, beforeEach, expect, jest, test} from '@jest/globals'
import {act, cleanup, renderHook} from '@testing-library/react'
import {useDaemonState} from '@/stores/daemon'
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
