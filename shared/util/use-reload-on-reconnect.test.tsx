/** @jest-environment jsdom */
/// <reference types="jest" />

import {afterEach, expect, jest, test} from '@jest/globals'
import {act, cleanup, renderHook} from '@testing-library/react'
import {useDaemonState} from '@/stores/daemon'
import {useReloadOnReconnect} from './use-reload-on-reconnect'

// the real store bumps handshakeGeneration on every startHandshake, and the
// epoch is memoized on it, so a test that never moves it makes every reconnect
// look like the same event.
let generation = 0
const setHandshake = (handshakeState: 'loading' | 'done' | 'failed') => {
  act(() => {
    if (handshakeState === 'loading') {
      generation += 1
    }
    useDaemonState.setState({handshakeGeneration: generation, handshakeState})
  })
}

afterEach(() => {
  cleanup()
  generation = 0
  useDaemonState.setState({handshakeGeneration: 0, handshakeState: 'loading'})
  jest.restoreAllMocks()
})

test('does not fire when mounted with handshake already done', () => {
  setHandshake('done')
  const cb = jest.fn()
  renderHook(() => useReloadOnReconnect(cb))
  expect(cb).not.toHaveBeenCalled()
})

test('fires once per reconnect (done -> loading -> done)', () => {
  setHandshake('done')
  const cb = jest.fn()
  renderHook(() => useReloadOnReconnect(cb))
  setHandshake('loading')
  expect(cb).not.toHaveBeenCalled()
  setHandshake('done')
  expect(cb).toHaveBeenCalledTimes(1)
  setHandshake('loading')
  setHandshake('done')
  expect(cb).toHaveBeenCalledTimes(2)
})

test('fires when mounted during a handshake that then completes', () => {
  setHandshake('loading')
  const cb = jest.fn()
  renderHook(() => useReloadOnReconnect(cb))
  setHandshake('done')
  expect(cb).toHaveBeenCalledTimes(1)
})

test('fires on recovery from a failed handshake', () => {
  setHandshake('failed')
  const cb = jest.fn()
  renderHook(() => useReloadOnReconnect(cb))
  setHandshake('done')
  expect(cb).toHaveBeenCalledTimes(1)
})

// the whole point of the epoch: every hook reacting to one reconnect is handed
// the same number, so the cached resources they drive collapse onto one rpc.
test('hands every hook the same epoch for one reconnect', () => {
  setHandshake('done')
  const first = jest.fn()
  const second = jest.fn()
  renderHook(() => useReloadOnReconnect(first))
  renderHook(() => useReloadOnReconnect(second))
  setHandshake('loading')
  setHandshake('done')
  expect(first).toHaveBeenCalledTimes(1)
  expect(second).toHaveBeenCalledTimes(1)
  const epoch = first.mock.calls[0]?.[0]
  expect(typeof epoch).toBe('number')
  expect(second).toHaveBeenCalledWith(epoch)
})

test('allocates a new epoch for each reconnect', () => {
  setHandshake('done')
  const cb = jest.fn()
  renderHook(() => useReloadOnReconnect(cb))
  setHandshake('loading')
  setHandshake('done')
  setHandshake('loading')
  setHandshake('done')
  expect(cb).toHaveBeenCalledTimes(2)
  const [first, second] = cb.mock.calls.map(call => (call as [number])[0])
  expect(second).toBeGreaterThan(first!)
})

test('stops firing once unmounted', () => {
  setHandshake('done')
  const cb = jest.fn()
  const {unmount} = renderHook(() => useReloadOnReconnect(cb))
  unmount()
  setHandshake('loading')
  setHandshake('done')
  expect(cb).not.toHaveBeenCalled()
})
