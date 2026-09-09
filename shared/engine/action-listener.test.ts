/// <reference types="jest" />
import {resetAllStores} from '@/util/zustand'

import {
  clearAllEngineActionListeners,
  EnginePriority,
  notifyEngineActionListeners,
  registerEngineHandlers,
  subscribeToEngineAction,
} from './action-listener'

const homeUIRefresh = {payload: {params: {}}, type: 'keybase.1.homeUI.homeUIRefresh'} as never

afterEach(() => {
  jest.restoreAllMocks()
  resetAllStores()
  clearAllEngineActionListeners()
  unregisterAll()
})

// registerEngineHandlers deliberately survives resetAllStores, so this file has
// to take its own registrations back down between tests
const registrations: Array<() => void> = []
const unregisterAll = () => {
  for (const unregister of registrations.splice(0, registrations.length)) unregister()
}

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

test('a stale unsubscribe from before a reset leaves later subscribers alone', () => {
  const before = jest.fn()
  const staleUnsubscribe = subscribeToEngineAction('keybase.1.homeUI.homeUIRefresh', before)

  clearAllEngineActionListeners()

  const after = jest.fn()
  subscribeToEngineAction('keybase.1.homeUI.homeUIRefresh', after)

  // the component that subscribed before the reset unmounts late
  staleUnsubscribe()

  notifyEngineActionListeners({
    payload: {params: {}},
    type: 'keybase.1.homeUI.homeUIRefresh',
  } as never)
  expect(after).toHaveBeenCalledTimes(1)
  expect(before).not.toHaveBeenCalled()
})

// Case-arm position used to decide this; a registration has to say it out loud.
test('handlers run in priority order, then registration order', () => {
  const order: Array<string> = []
  subscribeToEngineAction('keybase.1.homeUI.homeUIRefresh', () => order.push('component'))
  registrations.push(registerEngineHandlers(
    {'keybase.1.homeUI.homeUIRefresh': () => order.push('platform')},
    {priority: EnginePriority.platform}
  ))
  registrations.push(registerEngineHandlers(
    {'keybase.1.homeUI.homeUIRefresh': () => order.push('sharedSecond')},
    {priority: EnginePriority.shared}
  ))
  registrations.push(registerEngineHandlers(
    {'keybase.1.homeUI.homeUIRefresh': () => order.push('sharedFirst')},
    {priority: EnginePriority.sharedFirst}
  ))
  registrations.push(registerEngineHandlers(
    {'keybase.1.homeUI.homeUIRefresh': () => order.push('config')},
    {priority: EnginePriority.config}
  ))

  notifyEngineActionListeners(homeUIRefresh)

  expect(order).toEqual(['sharedFirst', 'sharedSecond', 'config', 'component', 'platform'])
})

// Module init is what installs these, and nothing re-runs it after a sign-out.
test('a sign-out reset keeps module registrations and drops component subscriptions', () => {
  const registered = jest.fn()
  const subscribed = jest.fn()
  registrations.push(registerEngineHandlers({'keybase.1.homeUI.homeUIRefresh': registered}))
  subscribeToEngineAction('keybase.1.homeUI.homeUIRefresh', subscribed)

  resetAllStores()
  notifyEngineActionListeners(homeUIRefresh)

  expect(registered).toHaveBeenCalledTimes(1)
  expect(subscribed).not.toHaveBeenCalled()
})

test('unregistering removes every type the registration covered', () => {
  const home = jest.fn()
  const badge = jest.fn()
  const unregister = registerEngineHandlers({
    'keybase.1.NotifyBadges.badgeState': badge,
    'keybase.1.homeUI.homeUIRefresh': home,
  })
  registrations.push(unregister)

  unregister()
  notifyEngineActionListeners(homeUIRefresh)
  notifyEngineActionListeners({payload: {params: {}}, type: 'keybase.1.NotifyBadges.badgeState'} as never)

  expect(home).not.toHaveBeenCalled()
  expect(badge).not.toHaveBeenCalled()
})
