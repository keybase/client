/// <reference types="jest" />
import {resetAllStores} from '@/util/zustand'

import {notifyEngineActionListeners, subscribeToEngineAction} from './action-listener'

const unsubscribes: Array<() => void> = []
const subscribe = (...args: Parameters<typeof subscribeToEngineAction>) => {
  const unsubscribe = subscribeToEngineAction(...args)
  unsubscribes.push(unsubscribe)
  return unsubscribe
}

afterEach(() => {
  unsubscribes.splice(0).forEach(unsubscribe => unsubscribe())
  jest.restoreAllMocks()
  resetAllStores()
})

test('engine action listeners only fire for matching action types', () => {
  const homeListener = jest.fn()
  const badgeListener = jest.fn()

  const unsubscribeHome = subscribe('keybase.1.homeUI.homeUIRefresh', homeListener)
  subscribe('keybase.1.NotifyBadges.badgeState', badgeListener)

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

// an account switch resets the stores while the screens that subscribed stay mounted
test('a store reset leaves each subscription to its owner', () => {
  const homeListener = jest.fn()

  const unsubscribe = subscribe('keybase.1.homeUI.homeUIRefresh', homeListener)
  resetAllStores()

  notifyEngineActionListeners({
    payload: {params: {}},
    type: 'keybase.1.homeUI.homeUIRefresh',
  } as never)
  expect(homeListener).toHaveBeenCalledTimes(1)

  unsubscribe()
  notifyEngineActionListeners({
    payload: {params: {}},
    type: 'keybase.1.homeUI.homeUIRefresh',
  } as never)
  expect(homeListener).toHaveBeenCalledTimes(1)
})

test('a repeated unsubscribe leaves later subscribers alone', () => {
  const before = jest.fn()
  const unsubscribeBefore = subscribe('keybase.1.homeUI.homeUIRefresh', before)
  unsubscribeBefore()

  const after = jest.fn()
  subscribe('keybase.1.homeUI.homeUIRefresh', after)

  unsubscribeBefore()

  notifyEngineActionListeners({
    payload: {params: {}},
    type: 'keybase.1.homeUI.homeUIRefresh',
  } as never)
  expect(after).toHaveBeenCalledTimes(1)
  expect(before).not.toHaveBeenCalled()
})
