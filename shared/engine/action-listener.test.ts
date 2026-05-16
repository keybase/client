/// <reference types="jest" />
import {resetAllStores} from '@/util/zustand'

import {
  clearAllEngineActionListeners,
  notifyEngineActionListeners,
  subscribeToEngineAction,
} from './action-listener'

afterEach(() => {
  jest.restoreAllMocks()
  resetAllStores()
})

test('engine action listeners only fire for matching action types', () => {
  const homeListener = jest.fn()
  const badgeListener = jest.fn()

  const unsubscribeHome = subscribeToEngineAction('keybase.1.homeUI.homeUIRefresh', homeListener)
  subscribeToEngineAction('keybase.1.NotifyBadges.badgeState', badgeListener)

  notifyEngineActionListeners({
    payload: {params: {}},
    type: 'keybase.1.homeUI.homeUIRefresh',
  } as never)

  expect(homeListener).toHaveBeenCalledTimes(1)
  expect(badgeListener).not.toHaveBeenCalled()

  unsubscribeHome()

  notifyEngineActionListeners({
    payload: {params: {}},
    type: 'keybase.1.homeUI.homeUIRefresh',
  } as never)

  expect(homeListener).toHaveBeenCalledTimes(1)
})

test('resetAllStores clears engine action listeners', () => {
  const homeListener = jest.fn()

  subscribeToEngineAction('keybase.1.homeUI.homeUIRefresh', homeListener)
  resetAllStores()

  notifyEngineActionListeners({
    payload: {params: {}},
    type: 'keybase.1.homeUI.homeUIRefresh',
  } as never)

  expect(homeListener).not.toHaveBeenCalled()
})

test('clearAll removes all registered listeners', () => {
  const homeListener = jest.fn()

  subscribeToEngineAction('keybase.1.homeUI.homeUIRefresh', homeListener)
  clearAllEngineActionListeners()

  notifyEngineActionListeners({
    payload: {params: {}},
    type: 'keybase.1.homeUI.homeUIRefresh',
  } as never)

  expect(homeListener).not.toHaveBeenCalled()
})
