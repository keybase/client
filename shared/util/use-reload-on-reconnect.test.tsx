/** @jest-environment jsdom */
/// <reference types="jest" />

import {afterEach, expect, jest, test} from '@jest/globals'
import {act, cleanup, renderHook} from '@testing-library/react'
import {useDaemonState} from '@/stores/daemon'
import {useReloadOnReconnect} from './use-reload-on-reconnect'

const setHandshake = (handshakeState: 'loading' | 'done' | 'failed') => {
  act(() => {
    useDaemonState.setState({handshakeState})
  })
}

afterEach(() => {
  cleanup()
  useDaemonState.setState({handshakeState: 'loading'})
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
