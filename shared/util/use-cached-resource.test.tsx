/** @jest-environment jsdom */
/// <reference types="jest" />

import {afterEach, beforeEach, expect, jest, test} from '@jest/globals'
import {act, cleanup, renderHook} from '@testing-library/react'
import {useDaemonState} from '@/stores/daemon'
import {createCachedResourceCache, useCachedResource} from './use-cached-resource'

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

test('reload() bypasses an orphaned in-flight request', async () => {
  const cache = createCachedResourceCache<string, string>('', 'k')
  let resolveSecond: ((v: string) => void) | undefined
  const load = jest
    .fn<() => Promise<string>>()
    .mockImplementationOnce(async () => new Promise<string>(() => {}))
    .mockImplementationOnce(
      async () =>
        new Promise<string>(resolve => {
          resolveSecond = resolve
        })
    )
  const {result} = renderHook(() => useCachedResource({cache, cacheKey: 'k', initialData: '', load, staleMs: 10_000}))
  await flush()
  expect(load).toHaveBeenCalledTimes(1)
  expect(result.current.loading).toBe(true)

  act(() => {
    void result.current.reload()
  })
  await flush()
  expect(load).toHaveBeenCalledTimes(2)

  await act(async () => {
    resolveSecond?.('fresh')
    await Promise.resolve()
  })
  expect(result.current.data).toBe('fresh')
})
