/// <reference types="jest" />
import * as Tabs from '@/constants/tabs'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {setPushTapAck, useNavigationIntentsState} from '@/stores/navigation-intents'
import {useRouterState} from '@/stores/router'
import {resetAllStores} from '@/util/zustand'
import {emitDeepLink, enqueuePushTapRoute} from './deep-link-emitter'
import {subscribeNavigationIntents} from './linking'

// Stands in for react-native-kb's native tap slot; only its ack is reached from here.
const mockAckPushTap = jest.fn()
setPushTapAck(id => mockAckPushTap(id))

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
  mockAckPushTap.mockClear()
  useConfigState.getState().dispatch.setLoggedIn(true)
  useConfigState.getState().dispatch.setUserSwitching(false)
  setCurrentUser('current-uid')
  useNavigationIntentsState.getState().dispatch.setNavigationReady(true, 'current-uid')
})

afterEach(() => {
  useRouterState.setState({navState: undefined})
  clearIntent()
  resetAllStores()
  jest.restoreAllMocks()
})

test('consuming an intent acks the tap route it carries', () => {
  const ack = mockAckPushTap
  const listener = jest.fn()
  // The store notifies subscribers synchronously, so a ready router consumes (and acks) an
  // enqueued intent before enqueuePushTapRoute below returns.
  const unsubscribe = subscribeNavigationIntents(listener, jest.fn())

  enqueuePushTapRoute({id: 4242, targetUid: 'current-uid', url: 'keybase://convid/tap-conversation'})

  expect(listener).toHaveBeenCalledWith('keybase://convid/tap-conversation')
  expect(ack).toHaveBeenCalledWith(4242)
  unsubscribe()
})

test('a stale intent that is dropped without navigating still acks its tap route', () => {
  const ack = mockAckPushTap
  const now = jest.spyOn(Date, 'now')
  now.mockReturnValue(1_000)
  useConfigState.getState().dispatch.setUserSwitching(true, 'testuser')
  const listener = jest.fn()
  const unsubscribe = subscribeNavigationIntents(listener, jest.fn())

  enqueuePushTapRoute({id: 4343, targetUid: 'current-uid', url: 'keybase://convid/stale-tap'})
  now.mockReturnValue(1_000 + 5 * 60_000 + 1)
  useConfigState.getState().dispatch.setUserSwitching(false)

  expect(listener).not.toHaveBeenCalled()
  expect(ack).toHaveBeenCalledWith(4343)
  unsubscribe()
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
  useConfigState.getState().dispatch.setUserSwitching(true, 'testuser')
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

  useConfigState.getState().dispatch.setUserSwitching(true, 'testuser')
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

  useConfigState.getState().dispatch.setUserSwitching(true, 'testuser')
  enqueuePushTapRoute({id: 4444, targetUid: 'target-uid', url: 'keybase://convid/switch-target-conversation'})
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

// This suite loads as desktop, so isSplit is true: the open conversation is chatRoot's param in
// the chat tab (intent-consumption-phone.test.ts covers the phone shape).
const chatTabState = (conversationIDKey: string) => ({
  index: 0,
  routes: [{name: Tabs.chatTab, state: {index: 0, routes: [{name: 'chatRoot', params: {conversationIDKey}}]}}],
})
const openConversation = (conversationIDKey: string) =>
  useRouterState.setState({
    navState: {index: 0, routes: [{name: 'loggedIn', state: chatTabState(conversationIDKey)}]},
  } as never)

test('a tap for the conversation already open acks without navigating', () => {
  openConversation('0000ab')
  const listener = jest.fn()
  const handleAppLink = jest.fn()
  const unsubscribe = subscribeNavigationIntents(listener, handleAppLink)

  enqueuePushTapRoute({id: 4545, targetUid: 'current-uid', url: 'keybase://convid/0000ab'})

  expect(listener).not.toHaveBeenCalled()
  expect(handleAppLink).not.toHaveBeenCalled()
  expect(mockAckPushTap).toHaveBeenCalledWith(4545)
  expect(useNavigationIntentsState.getState().intent).toBeUndefined()
  unsubscribe()
})

test('a tap for a different conversation still navigates', () => {
  openConversation('0000ab')
  const listener = jest.fn()
  const unsubscribe = subscribeNavigationIntents(listener, jest.fn())

  enqueuePushTapRoute({id: 4646, targetUid: 'current-uid', url: 'keybase://convid/0000cd'})

  expect(listener).toHaveBeenCalledWith('keybase://convid/0000cd')
  expect(mockAckPushTap).toHaveBeenCalledWith(4646)
  unsubscribe()
})

test('a tap for the split conversation under a modal still navigates', () => {
  useRouterState.setState({
    navState: {
      index: 1,
      routes: [{name: 'loggedIn', state: chatTabState('0000ab')}, {name: 'settingsTabs.devicesTab'}],
    },
  } as never)
  const listener = jest.fn()
  const unsubscribe = subscribeNavigationIntents(listener, jest.fn())

  enqueuePushTapRoute({id: 4747, targetUid: 'current-uid', url: 'keybase://convid/0000ab'})

  expect(listener).toHaveBeenCalledWith('keybase://convid/0000ab')
  unsubscribe()
})

test('a tap for the split conversation while another tab is focused still navigates', () => {
  useRouterState.setState({
    navState: {
      index: 0,
      routes: [
        {
          name: 'loggedIn',
          state: {
            index: 1,
            routes: [chatTabState('0000ab').routes[0], {name: Tabs.peopleTab}],
          },
        },
      ],
    },
  } as never)
  const listener = jest.fn()
  const unsubscribe = subscribeNavigationIntents(listener, jest.fn())

  enqueuePushTapRoute({id: 4848, targetUid: 'current-uid', url: 'keybase://convid/0000ab'})

  expect(listener).toHaveBeenCalledWith('keybase://convid/0000ab')
  unsubscribe()
})

test('a plain link to the conversation already open still navigates', () => {
  openConversation('0000ab')
  const listener = jest.fn()
  const unsubscribe = subscribeNavigationIntents(listener, jest.fn())

  emitDeepLink('keybase://convid/0000ab')

  expect(listener).toHaveBeenCalledWith('keybase://convid/0000ab')
  unsubscribe()
})
