/// <reference types="jest" />
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {useNavigationIntentsState} from '@/stores/navigation-intents'
import {resetAllStores} from '@/util/zustand'
import {emitDeepLink} from './deep-link-emitter'
import {subscribeNavigationIntents} from './linking'

const setCurrentUser = (uid: string) => {
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: '',
    deviceName: '',
    uid,
    username: uid,
  })
}

// resetAllStores runs the intents store's own resetState, which deliberately keeps
// an account-targeted intent alive across an account switch. Acknowledge whatever
// is queued first so nothing leaks into the next test.
const clearIntent = () => {
  const {intent, dispatch} = useNavigationIntentsState.getState()
  if (intent) {
    dispatch.acknowledge(intent.id)
  }
  dispatch.resetState()
}

beforeEach(() => {
  useConfigState.getState().dispatch.setLoggedIn(true)
  useConfigState.getState().dispatch.setUserSwitching(false)
  setCurrentUser('current-uid')
  useNavigationIntentsState.getState().dispatch.setNavigationReady(true, 'current-uid')
})

afterEach(() => {
  jest.restoreAllMocks()
  clearIntent()
  resetAllStores()
})

test('profile links route imperatively so their back stack is built', () => {
  const listener = jest.fn()
  const handleAppLink = jest.fn()
  const unsubscribe = subscribeNavigationIntents(listener, handleAppLink)

  emitDeepLink('keybase://profile/show/testuser')

  expect(listener).not.toHaveBeenCalled()
  expect(handleAppLink).toHaveBeenCalledWith('keybase://profile/show/testuser')
  expect(useNavigationIntentsState.getState().intent).toBeUndefined()
  unsubscribe()
})

test('known non-profile links use react navigation linking state', () => {
  const listener = jest.fn()
  const handleAppLink = jest.fn()
  const unsubscribe = subscribeNavigationIntents(listener, handleAppLink)

  emitDeepLink('keybase://convid/conv-1')

  expect(listener).toHaveBeenCalledWith('keybase://convid/conv-1')
  expect(handleAppLink).not.toHaveBeenCalled()
  unsubscribe()
})

test('a stale intent is discarded instead of navigating', () => {
  const now = jest.spyOn(Date, 'now')
  now.mockReturnValue(1_000)

  // block consumption so the intent sits in the queue while time passes
  useConfigState.getState().dispatch.setUserSwitching(true)
  const listener = jest.fn()
  const handleAppLink = jest.fn()
  const unsubscribe = subscribeNavigationIntents(listener, handleAppLink)

  emitDeepLink('keybase://convid/stale-conversation')
  expect(useNavigationIntentsState.getState().intent).toBeDefined()

  now.mockReturnValue(1_000 + 5 * 60_000 + 1)
  useConfigState.getState().dispatch.setUserSwitching(false)

  expect(listener).not.toHaveBeenCalled()
  expect(handleAppLink).not.toHaveBeenCalled()
  expect(useNavigationIntentsState.getState().intent).toBeUndefined()
  unsubscribe()
})

test('an intent that is still within its lifetime is consumed after the block clears', () => {
  const now = jest.spyOn(Date, 'now')
  now.mockReturnValue(1_000)

  useConfigState.getState().dispatch.setUserSwitching(true)
  const listener = jest.fn()
  const unsubscribe = subscribeNavigationIntents(listener, jest.fn())

  emitDeepLink('keybase://convid/fresh-conversation')

  now.mockReturnValue(1_000 + 5 * 60_000 - 1)
  useConfigState.getState().dispatch.setUserSwitching(false)

  expect(listener).toHaveBeenCalledWith('keybase://convid/fresh-conversation')
  unsubscribe()
})

test('a link enqueued while navigating is consumed right after the first one', () => {
  const seen: Array<string> = []
  const listener = jest.fn((url: string) => {
    seen.push(url)
    if (seen.length === 1) {
      // a navigation side effect enqueues another link synchronously
      emitDeepLink('keybase://convid/second-conversation')
    }
  })
  const unsubscribe = subscribeNavigationIntents(listener, jest.fn())

  emitDeepLink('keybase://convid/first-conversation')

  expect(seen).toEqual(['keybase://convid/first-conversation', 'keybase://convid/second-conversation'])
  expect(useNavigationIntentsState.getState().intent).toBeUndefined()
  unsubscribe()
})

test('unsubscribing leaves later links queued for the next router', () => {
  const listener = jest.fn()
  const handleAppLink = jest.fn()
  const unsubscribe = subscribeNavigationIntents(listener, handleAppLink)
  unsubscribe()

  emitDeepLink('keybase://convid/after-unsubscribe')

  expect(listener).not.toHaveBeenCalled()
  expect(handleAppLink).not.toHaveBeenCalled()
  expect(useNavigationIntentsState.getState().intent?.url).toBe('keybase://convid/after-unsubscribe')
})

test('an account-targeted intent survives the store reset an account switch performs', () => {
  const listener = jest.fn()
  const unsubscribe = subscribeNavigationIntents(listener, jest.fn())

  useConfigState.getState().dispatch.setUserSwitching(true)
  emitDeepLink('keybase://convid/switch-target-conversation', {targetUid: 'target-uid'})
  expect(listener).not.toHaveBeenCalled()

  // the service's loggedOut notification lands mid-switch and resets every store
  useConfigState.getState().dispatch.setLoggedIn(false)
  expect(useNavigationIntentsState.getState().intent?.url).toBe(
    'keybase://convid/switch-target-conversation'
  )

  useConfigState.getState().dispatch.setLoggedIn(true)
  setCurrentUser('target-uid')
  useConfigState.getState().dispatch.setUserSwitching(false)
  useNavigationIntentsState.getState().dispatch.setNavigationReady(true, 'target-uid')

  expect(listener).toHaveBeenCalledWith('keybase://convid/switch-target-conversation')
  unsubscribe()
})
