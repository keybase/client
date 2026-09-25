/// <reference types="jest" />
import * as T from '@/constants/types'
import * as Tabs from '@/constants/tabs'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {setPushTapAck, useNavigationIntentsState} from '@/stores/navigation-intents'
import {usePushState} from '@/stores/push'
import {peekPendingAccountSwitchTab, rememberAccountSwitchTab} from './account-switch'
import {createLinkingConfig} from './linking'
import {enqueuePushTapRoute} from './deep-link-emitter'

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

type Startup = {
  conversation: T.Chat.ConversationIDKey
  conversationUid?: string
  tab?: Tabs.Tab
}

// Set directly rather than via setStartupDetails: that dispatch is one-shot
// (guarded by startup.loaded, which resetState deliberately preserves).
const setStartup = (st: Partial<Startup>) => {
  useConfigState.setState({
    startup: {
      conversation: T.Chat.noConversationIDKey,
      loaded: true,
      ...st,
    },
  })
}

const getInitialURL = async () => {
  const config = createLinkingConfig(handleAppLink)
  return config.getInitialURL?.()
}

const handleAppLink = jest.fn()

// A push tap's id must not repeat across tests any more than it does across taps.
let nextTapID = 5000
const tapID = () => ++nextTapID

beforeEach(() => {
  mockAckPushTap.mockClear()
  useConfigState.getState().dispatch.setLoggedIn(true)
  setCurrentUser('current-uid')
})

afterEach(() => {
  handleAppLink.mockReset()
  // resetAllStores deliberately keeps account-targeted intents; drop them here.
  const {intent, dispatch} = useNavigationIntentsState.getState()
  if (intent) dispatch.acknowledge(intent.id)
  jest.restoreAllMocks()
  rememberAccountSwitchTab('', '', undefined)
  resetAllStores()
})

test('an account switch starts on the switcher tab without consuming it before onReady', async () => {
  rememberAccountSwitchTab('testuser', 'testuser-mac', Tabs.teamsTab)
  setCurrentUser('testuser-mac')
  setStartup({conversation: 'conv-1', conversationUid: 'testuser-mac', tab: Tabs.chatTab})

  await expect(getInitialURL()).resolves.toBe(`keybase://${Tabs.teamsTab}`)
  expect(peekPendingAccountSwitchTab('testuser-mac')).toBe(Tabs.teamsTab)
})

test('a switcher tab remembered for another account does not preempt the saved route', async () => {
  rememberAccountSwitchTab('current-uid', 'testuser-mac', Tabs.teamsTab)
  setStartup({tab: Tabs.chatTab})

  await expect(getInitialURL()).resolves.toBe(`keybase://${Tabs.chatTab}`)
})

test('a logged out app has no initial url', async () => {
  useConfigState.getState().dispatch.setLoggedIn(false)
  setStartup({tab: Tabs.chatTab})

  await expect(getInitialURL()).resolves.toBeNull()
})

test('a saved tab becomes a tab deep link', async () => {
  setStartup({tab: Tabs.teamsTab})

  await expect(getInitialURL()).resolves.toBe(`keybase://${Tabs.teamsTab}`)
})

test('a saved conversation wins over a saved tab', async () => {
  setStartup({conversation: 'conv-1', tab: Tabs.teamsTab})

  await expect(getInitialURL()).resolves.toBe('keybase://convid/conv-1')
})

test('a placeholder conversation id is ignored', async () => {
  setStartup({conversation: T.Chat.pendingWaitingConversationIDKey, tab: Tabs.teamsTab})

  await expect(getInitialURL()).resolves.toBe(`keybase://${Tabs.teamsTab}`)
})

test('a conversation persisted by another account is dropped', async () => {
  setStartup({conversation: 'conv-1', conversationUid: 'other-uid', tab: Tabs.teamsTab})

  await expect(getInitialURL()).resolves.toBe(`keybase://${Tabs.teamsTab}`)
})

test('a conversation persisted by this account is kept', async () => {
  setStartup({conversation: 'conv-1', conversationUid: 'current-uid'})

  await expect(getInitialURL()).resolves.toBe('keybase://convid/conv-1')
})

test('a cold tap for the current account is the startup route, ahead of saved state', async () => {
  setStartup({conversation: 'conv-1'})
  enqueuePushTapRoute({id: tapID(), targetUid: 'current-uid', url: 'keybase://convid/0000ab'})

  await expect(getInitialURL()).resolves.toBe('keybase://convid/0000ab')
  expect(useNavigationIntentsState.getState().intent).toBeUndefined()
})

test('getInitialURL taking a cold tap acks its route', async () => {
  const ack = mockAckPushTap
  const id = tapID()
  setStartup({conversation: 'conv-1'})
  enqueuePushTapRoute({id, targetUid: 'current-uid', url: 'keybase://convid/0000ab'})
  expect(ack).not.toHaveBeenCalled()

  await expect(getInitialURL()).resolves.toBe('keybase://convid/0000ab')

  expect(ack).toHaveBeenCalledWith(id)
})

test('a cold tap for another account opens saved state and waits for the switch', async () => {
  setStartup({conversation: 'conv-1'})
  enqueuePushTapRoute({id: tapID(), targetUid: 'other-uid', url: 'keybase://convid/0000ab'})

  await expect(getInitialURL()).resolves.toBe('keybase://convid/conv-1')
  expect(useNavigationIntentsState.getState().intent?.targetUid).toBe('other-uid')
})

test('the push prompt wins when there is nothing saved to restore', async () => {
  usePushState.setState({hasPermissions: false, justSignedUp: false, showPushPrompt: true})
  setStartup({})

  await expect(getInitialURL()).resolves.toBe('keybase://settingsPushPrompt')
})

test('the push prompt wins over a cold tap, which stays queued for the router', async () => {
  usePushState.setState({hasPermissions: false, justSignedUp: false, showPushPrompt: true})
  setStartup({})
  enqueuePushTapRoute({id: tapID(), targetUid: 'current-uid', url: 'keybase://convid/0000ab'})

  await expect(getInitialURL()).resolves.toBe('keybase://settingsPushPrompt')
  expect(useNavigationIntentsState.getState().intent?.url).toBe('keybase://convid/0000ab')
})

test('the push prompt does not preempt a restored tab', async () => {
  usePushState.setState({hasPermissions: false, justSignedUp: false, showPushPrompt: true})
  setStartup({tab: Tabs.chatTab})

  await expect(getInitialURL()).resolves.toBe(`keybase://${Tabs.chatTab}`)
})

test('a fresh signup does not get the push prompt deep link', async () => {
  usePushState.setState({hasPermissions: false, justSignedUp: true, showPushPrompt: true})
  setStartup({})

  await expect(getInitialURL()).resolves.toBeNull()
})

test('an android share opens the share modal when nothing is restored', async () => {
  useConfigState
    .getState()
    .dispatch.setAndroidShare({text: 'hello', type: T.RPCGen.IncomingShareType.text})
  setStartup({})

  await expect(getInitialURL()).resolves.toBe('keybase://incoming-share')
})

test('an android share does not preempt a restored conversation', async () => {
  useConfigState
    .getState()
    .dispatch.setAndroidShare({text: 'hello', type: T.RPCGen.IncomingShareType.text})
  setStartup({conversation: 'conv-1'})

  await expect(getInitialURL()).resolves.toBe('keybase://convid/conv-1')
})

test('nothing to restore produces no initial url', async () => {
  setStartup({})

  await expect(getInitialURL()).resolves.toBeNull()
})

test('the returned initial url is recorded so the same deep link is not re-enqueued', async () => {
  setStartup({tab: Tabs.chatTab})

  await getInitialURL()

  expect(useNavigationIntentsState.getState().lastHandledIntent?.url).toBe(`keybase://${Tabs.chatTab}`)
})

test('a queued tap older than the intent lifetime is not the startup route', async () => {
  setStartup({conversation: 'conv-1'})
  enqueuePushTapRoute({id: tapID(), targetUid: 'current-uid', url: 'keybase://convid/0000ab'})
  const intent = useNavigationIntentsState.getState().intent
  useNavigationIntentsState.setState({intent: {...intent!, createdAt: Date.now() - 6 * 60_000}})

  await expect(getInitialURL()).resolves.toBe('keybase://convid/conv-1')
})
