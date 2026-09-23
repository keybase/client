/// <reference types="jest" />
// Phone shapes. isSplit is computed at module load and this suite loads as desktop, so only
// mocking the module gets the phone layout, where an open conversation is pushed onto the root
// stack above the tabs.
jest.mock('@/constants/chat/layout', () => ({isSplit: false, threadRouteName: 'chatConversation'}))
import * as Tabs from '@/constants/tabs'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {setPushTapAck, useNavigationIntentsState} from '@/stores/navigation-intents'
import {useRouterState} from '@/stores/router'
import {resetAllStores} from '@/util/zustand'
import {enqueuePushTapRoute} from './deep-link-emitter'
import {subscribeNavigationIntents} from './linking'

const mockAckPushTap = jest.fn()
setPushTapAck(id => mockAckPushTap(id))

beforeEach(() => {
  mockAckPushTap.mockClear()
  useConfigState.getState().dispatch.setLoggedIn(true)
  useConfigState.getState().dispatch.setUserSwitching(false)
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: '',
    deviceName: '',
    uid: 'current-uid',
    username: 'current-uid',
  })
  useNavigationIntentsState.getState().dispatch.setNavigationReady(true, 'current-uid')
})

afterEach(() => {
  useRouterState.setState({navState: undefined})
  const {intent, dispatch} = useNavigationIntentsState.getState()
  if (intent) {
    dispatch.acknowledge(intent.id)
  }
  dispatch.resetState()
  resetAllStores()
})

const openConversation = (conversationIDKey: string) =>
  useRouterState.setState({
    navState: {
      index: 1,
      routes: [{name: 'loggedIn'}, {name: 'chatConversation', params: {conversationIDKey}}],
    },
  } as never)

test('a tap for the conversation already open acks without navigating', () => {
  openConversation('0000ab')
  const listener = jest.fn()
  const handleAppLink = jest.fn()
  const unsubscribe = subscribeNavigationIntents(listener, handleAppLink)

  enqueuePushTapRoute({id: 5454, targetUid: 'current-uid', url: 'keybase://convid/0000ab'})

  expect(listener).not.toHaveBeenCalled()
  expect(handleAppLink).not.toHaveBeenCalled()
  expect(mockAckPushTap).toHaveBeenCalledWith(5454)
  unsubscribe()
})

test('a tap for a different conversation still navigates', () => {
  openConversation('0000ab')
  const listener = jest.fn()
  const unsubscribe = subscribeNavigationIntents(listener, jest.fn())

  enqueuePushTapRoute({id: 5555, targetUid: 'current-uid', url: 'keybase://convid/0000cd'})

  expect(listener).toHaveBeenCalledWith('keybase://convid/0000cd')
  unsubscribe()
})

// A phone's chatRoot is the inbox; a conversationIDKey param on it is not an open thread.
test('the split shape on a phone is not an open conversation', () => {
  useRouterState.setState({
    navState: {
      index: 0,
      routes: [
        {
          name: 'loggedIn',
          state: {
            index: 0,
            routes: [
              {
                name: Tabs.chatTab,
                state: {index: 0, routes: [{name: 'chatRoot', params: {conversationIDKey: '0000ab'}}]},
              },
            ],
          },
        },
      ],
    },
  } as never)
  const listener = jest.fn()
  const unsubscribe = subscribeNavigationIntents(listener, jest.fn())

  enqueuePushTapRoute({id: 5656, targetUid: 'current-uid', url: 'keybase://convid/0000ab'})

  expect(listener).toHaveBeenCalledWith('keybase://convid/0000ab')
  unsubscribe()
})
