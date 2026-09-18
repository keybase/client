/// <reference types="jest" />
import * as T from '@/constants/types'
import * as Tabs from '@/constants/tabs'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {useNavigationIntentsState} from '@/stores/navigation-intents'
import {usePushState} from '@/stores/push'
import {createLinkingConfig} from './linking'
import {enqueuePushTapRoute} from './deep-link-emitter'

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

beforeEach(() => {
  useConfigState.getState().dispatch.setLoggedIn(true)
  setCurrentUser('current-uid')
})

afterEach(() => {
  handleAppLink.mockReset()
  // resetAllStores deliberately keeps account-targeted intents; drop them here.
  const {intent, dispatch} = useNavigationIntentsState.getState()
  if (intent) dispatch.acknowledge(intent.id)
  resetAllStores()
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
  enqueuePushTapRoute({targetUID: 'current-uid', url: 'keybase://convid/0000ab'})

  await expect(getInitialURL()).resolves.toBe('keybase://convid/0000ab')
  expect(useNavigationIntentsState.getState().intent).toBeUndefined()
})

test('a cold tap for another account opens saved state and waits for the switch', async () => {
  setStartup({conversation: 'conv-1'})
  enqueuePushTapRoute({targetUID: 'other-uid', url: 'keybase://convid/0000ab'})

  await expect(getInitialURL()).resolves.toBe('keybase://convid/conv-1')
  expect(useNavigationIntentsState.getState().intent?.targetUid).toBe('other-uid')
})

test('the push prompt wins when there is nothing saved to restore', async () => {
  usePushState.setState({hasPermissions: false, justSignedUp: false, showPushPrompt: true})
  setStartup({})

  await expect(getInitialURL()).resolves.toBe('keybase://settingsPushPrompt')
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
  enqueuePushTapRoute({targetUID: 'current-uid', url: 'keybase://convid/0000ab'})
  const intent = useNavigationIntentsState.getState().intent
  useNavigationIntentsState.setState({intent: {...intent!, createdAt: Date.now() - 6 * 60_000}})

  await expect(getInitialURL()).resolves.toBe('keybase://convid/conv-1')
})
