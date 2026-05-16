/// <reference types="jest" />
import {maxHandshakeTries} from '@/constants/values'
import {resetAllStores} from '@/util/zustand'
import {useDaemonState} from '../daemon'

afterEach(() => {
  jest.restoreAllMocks()
  resetAllStores()
})

test('wait tracks handshake waiters and keeps the first failure reason', () => {
  const store = useDaemonState

  store.setState(
    {
      ...store.getState(),
      handshakeState: 'waitingForWaiters',
      handshakeVersion: 1,
    },
    true
  )
  store.getState().dispatch.wait('config.getBootstrapStatus', 1, true, 'first')
  store.getState().dispatch.wait('config.getBootstrapStatus', 1, true, 'second')
  store.getState().dispatch.wait('config.getBootstrapStatus', 1, false, 'ignored later')

  expect(store.getState().handshakeWaiters.get('config.getBootstrapStatus')).toBe(1)
  expect(store.getState().handshakeFailedReason).toBe('first')
})

test('resetState preserves the handshake session but clears transient values', () => {
  const store = useDaemonState

  store.setState(
    {
      ...store.getState(),
      error: new Error('boom'),
      handshakeFailedReason: 'bad',
      handshakeRetriesLeft: 0,
      handshakeState: 'waitingForWaiters',
      handshakeVersion: 7,
    },
    true
  )

  store.getState().dispatch.resetState()

  expect(store.getState().handshakeState).toBe('waitingForWaiters')
  expect(store.getState().handshakeVersion).toBe(7)
  expect(store.getState().error).toMatchObject({message: 'boom'})
  expect(store.getState().handshakeFailedReason).toBe('')
  expect(store.getState().handshakeRetriesLeft).toBe(maxHandshakeTries)
})
