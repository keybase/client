import * as Settings from '@/constants/settings'
import * as Tabs from '@/constants/tabs'
import logger from '@/logger'
import {isSplit} from '@/constants/chat/layout'
import {isValidConversationIDKey, stringToConversationIDKey} from '@/constants/types/chat/common'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {useNavigationIntentsState} from '@/stores/navigation-intents'
import {useRouterState} from '@/stores/router'
import {usePushState} from '@/stores/push'
import type {LinkingOptions} from '@react-navigation/native'
import type {RootParamList} from './route-params'
import {Linking} from 'react-native'
import {emitDeepLink, normalizeUrl, setInitialURLOnce} from './deep-link-emitter'
// Re-exported so existing importers ('@/router-v2/linking') keep working; the
// definitions live in the dependency-free './deep-link-emitter' leaf.
export {emitDeepLink, normalizeUrl} from './deep-link-emitter'

// ---- State building helpers ----

type PartialRoute = {
  name: string
  params?: Record<string, unknown>
  state?: PartialNavState
}

type PartialNavState = {
  routes: Array<PartialRoute>
  index?: number
}

// Build state for navigating to a screen within a tab
const makeTabState = (
  tab: string,
  screenStack?: Array<{name: string; params?: Record<string, unknown>}>
): PartialNavState => {
  const tabRoute: PartialRoute = {name: tab}
  if (screenStack && screenStack.length > 0) {
    tabRoute.state = {
      index: screenStack.length - 1,
      routes: screenStack,
    }
  }
  return {
    index: 0,
    routes: [{name: 'loggedIn', state: {index: 0, routes: [tabRoute]}}],
  }
}

// Build state for navigating to a chat conversation
export const makeChatConversationState = (conversationIDKey: string): PartialNavState => {
  if (isSplit) {
    // Tablet/desktop: chatRoot with conversationIDKey param (split view)
    return makeTabState(Tabs.chatTab, [{name: 'chatRoot', params: {conversationIDKey}}])
  }
  // Phone: tabs at root, conversation pushed above them
  return {
    index: 1,
    routes: [
      {
        name: 'loggedIn',
        state: {
          index: 0,
          routes: [{name: Tabs.chatTab, state: {index: 0, routes: [{name: 'chatRoot', params: {}}]}}],
        },
      },
      {name: 'chatConversation', params: {conversationIDKey}},
    ],
  }
}

// Build state for a modal screen at root level. underTab selects which tab sits
// beneath the modal; without it loggedIn falls back to the initial (people) tab.
const makeModalState = (
  modalName: string,
  params?: Record<string, unknown>,
  underTab?: Tabs.AppTab
): PartialNavState => ({
  index: 1,
  routes: [
    underTab
      ? {name: 'loggedIn', state: {index: 0, routes: [{name: underTab}]}}
      : {name: 'loggedIn'},
    {name: modalName, ...(params ? {params} : {})},
  ],
})

// ---- URL pattern handling ----

// Check if a URL would produce navigation state from our getStateFromPath
export const isHandledByLinkingConfig = (url: string): boolean => {
  const prefix = 'keybase://'
  if (!url.startsWith(prefix)) return false
  return customGetStateFromPath(url.substring(prefix.length)) !== undefined
}

const navigationIntentLifetimeMs = 5 * 60_000

type TopRoute = {name?: string; params?: {conversationIDKey?: string}}

// A tapped chat push for the conversation already on top has nowhere to go: navigating resets the
// root state, remounting the thread and every tab stack.
const isTapForOpenConversation = (intent: {pushTapID?: number; url: string}) => {
  const prefix = 'keybase://convid/'
  if (intent.pushTapID === undefined || !intent.url.startsWith(prefix)) return false
  const conversationIDKey = intent.url.slice(prefix.length).split('/')[0]
  const navState = useRouterState.getState().navState as {routes?: ReadonlyArray<TopRoute>} | undefined
  const top = navState?.routes?.at(-1)
  return top?.name === 'chatConversation' && top.params?.conversationIDKey === conversationIDKey
}

// The router owns consumption. Producers can enqueue before this subscription
// exists, during an account switch, or before NavigationContainer is ready.
// Every dispatch.acknowledge below -- whether the intent is actually navigated or given up on as
// stale -- is also what acks a tapped notification natively, if the intent carries one.
export const subscribeNavigationIntents = (
  listener: (url: string) => void,
  handleAppLink: (link: string) => void
) => {
  let consumingID: number | undefined
  const consumeIfReady = () => {
    const {intent, navigationReady, navigationReadyForUid, dispatch} =
      useNavigationIntentsState.getState()
    if (!intent || consumingID !== undefined) return
    if (Date.now() - intent.createdAt > navigationIntentLifetimeMs) {
      dispatch.acknowledge(intent.id)
      return
    }

    const {loggedIn, userSwitching} = useConfigState.getState()
    const currentUid = useCurrentUserState.getState().uid
    if (!navigationReady || !loggedIn || userSwitching) return
    // Desktop mounts its NavigationContainer before the bootstrap RPC returns, so
    // onReady stamps readiness with an empty uid. That container goes on to serve
    // whoever logs in, so an unstamped router matches any account. Real account
    // switches remount the router (useUserSwitchNavKey) and re-stamp with the new
    // uid, which still blocks the old container here.
    if (navigationReadyForUid && navigationReadyForUid !== currentUid) return
    if (intent.targetUid && intent.targetUid !== currentUid) return

    consumingID = intent.id
    try {
      // Profile links use imperative navigation to build their intermediate
      // back stack. Other known URLs can use React Navigation's linking state.
      // This split only differs on mobile: desktop passes handleAppLink as both
      // arguments (router.tsx), so every URL there lands in handleKeybaseLink,
      // which must therefore stay correct for URLs the config also handles.
      if (isTapForOpenConversation(intent)) {
        logger.info('[PushTap] conversation already open, not navigating')
      } else if (intent.url.startsWith('keybase://profile/')) {
        handleAppLink(intent.url)
      } else if (isHandledByLinkingConfig(intent.url)) {
        listener(intent.url)
      } else {
        handleAppLink(intent.url)
      }
      dispatch.acknowledge(intent.id)
    } finally {
      consumingID = undefined
    }
    // A navigation callback can synchronously enqueue a newer intent. Its store
    // notification was ignored while this one was in flight, so retry it now.
    consumeIfReady()
  }

  const unsubscribeIntents = useNavigationIntentsState.subscribe(consumeIfReady)
  const unsubscribeConfig = useConfigState.subscribe(consumeIfReady)
  const unsubscribeCurrentUser = useCurrentUserState.subscribe(consumeIfReady)
  consumeIfReady()

  return () => {
    unsubscribeIntents()
    unsubscribeConfig()
    unsubscribeCurrentUser()
  }
}

// Custom getStateFromPath - handles keybase:// URL paths
const customGetStateFromPath = (
  path: string,
  _options?: object
): PartialNavState | undefined => {
  // path has prefix already stripped by React Navigation (e.g., "convid/abc123")
  const cleanPath = path.replace(/^\/+/, '').replace(/\?.*$/, '')
  if (!cleanPath) return undefined

  const parts = cleanPath.split('/')
  const root = parts[0]

  switch (root) {
    // keybase://convid/{conversationIDKey}
    case 'convid':
      if (parts[1]) {
        return makeChatConversationState(parts[1])
      }
      break

    // keybase://profile/show/{username}
    case 'profile':
      if (parts[1] === 'show' && parts[2]) {
        return makeTabState(Tabs.peopleTab, [
          {name: 'peopleRoot'},
          {name: 'profile', params: {username: parts[2]}},
        ])
      }
      // profile/new-proof is handled by handleAppLink fallback for now
      break

    // keybase://devices — a tap on a device push. Devices live in the Settings tab on phone and
    // tablet, and in their own tab on desktop.
    case 'devices':
      if (!isMobile) {
        return makeTabState(Tabs.devicesTab)
      }
      if (isSplit) {
        // Tablet: the Settings tab stack holds every settings route, so devices pushes
        // above the tab root, inside that stack.
        return makeTabState(Tabs.settingsTab, [{name: 'settingsRoot'}, {name: Settings.settingsDevicesTab}])
      }
      // Phone: settingsRoot is the only screen in the Settings tab stack, so a nested devices
      // route is filtered out on rehydrate and the tap lands on settingsRoot. Devices is
      // registered on the root stack there, above the tabs.
      return {
        index: 1,
        routes: [
          {
            name: 'loggedIn',
            state: {
              index: 0,
              routes: [
                {name: Tabs.settingsTab, state: {index: 0, routes: [{name: 'settingsRoot'}]}},
              ],
            },
          },
          {name: Settings.settingsDevicesTab},
        ],
      }

    // KBFS paths: keybase://private/..., keybase://public/...
    case 'private':
    case 'public': {
      try {
        const decoded = decodeURIComponent(cleanPath)
        const path = `/keybase/${decoded}`
        if (isSplit) {
          // Tablet: push the folder above the Files tab root, inside the tab stack.
          return makeTabState(Tabs.fsTab, [{name: 'fsRoot'}, {name: 'fsBrowse', params: {path}}])
        }
        // Phone: fsRoot is the only screen in the Files tab stack; folders open as
        // fsBrowse pushed on the root stack, above the tabs.
        return {
          index: 1,
          routes: [
            {
              name: 'loggedIn',
              state: {
                index: 0,
                routes: [{name: Tabs.fsTab, state: {index: 0, routes: [{name: 'fsRoot'}]}}],
              },
            },
            {name: 'fsBrowse', params: {path}},
          ],
        }
      } catch {}
      break
    }

    // keybase://incoming-share/{conversationIDKey?} — convID present when the user
    // picked a donated conversation directly in the share sheet
    case 'incoming-share':
      // Share always ends in chat, so park the chat tab (inbox) beneath the modal;
      // otherwise dismissing/back lands on the initial people tab.
      return makeModalState(
        'incomingShareNew',
        parts[1] ? {selectedConversationIDKey: stringToConversationIDKey(parts[1])} : undefined,
        Tabs.chatTab
      )

    // keybase://settingsPushPrompt
    case 'settingsPushPrompt':
      return makeModalState('settingsPushPrompt')

    // keybase://settingsAddPhone — where https://keybase.io/phone-app lands. Settings sits
    // under the modal so dismissing it leaves the invitee somewhere they can find it again.
    case 'settingsAddPhone':
      return makeModalState('settingsAddPhone', undefined, Tabs.settingsTab)

    // Tab switches: keybase://tabs.chatTab, etc.
    case Tabs.chatTab:
    case Tabs.peopleTab:
    case Tabs.teamsTab:
    case Tabs.fsTab:
    case Tabs.settingsTab:
    case Tabs.cryptoTab:
    case Tabs.devicesTab:
    case Tabs.gitTab:
      return makeTabState(root)

    default:
      break
  }

  return undefined
}

// ---- Linking config ----

// Known URLs become launch state; the rest open imperatively once the router is up.
// setInitialURLOnce also consumes: markInitialURLHandled clears a pending intent with the
// same URL, so subscribeNavigationIntents won't navigate to it a second time, and acks the
// intent's tapped notification natively if it carried one.
const openInitialLink = (link: string, handleAppLink: (link: string) => void) => {
  if (isHandledByLinkingConfig(link)) return setInitialURLOnce(link)
  setInitialURLOnce(link)
  setTimeout(() => handleAppLink(link), 1)
  return null
}

export const createLinkingConfig = (
  handleAppLink: (link: string) => void
): LinkingOptions<RootParamList> => {
  return {
    getInitialURL: async () => {
      const {loggedIn, startup, androidShare} = useConfigState.getState()
      if (!loggedIn) return null

      const {tab: startupTab} = startup
      let startupConversation = startup.conversation
      if (!isValidConversationIDKey(startupConversation)) {
        startupConversation = ''
      }

      // Only restore a conv that belongs to the logged-in account; see persistRoute
      // (ui.routeState2 is device-global, so it can hold another account's conv).
      const {uid: currentUid} = useCurrentUserState.getState()
      if (startupConversation && startup.conversationUid && startup.conversationUid !== currentUid) {
        startupConversation = ''
      }

      // A tapped push picks where the app opens, once its account is current. A tap for
      // another account stays queued until account-link-switch has switched to it. The same
      // lifetime applies here as in subscribeNavigationIntents.
      const {intent} = useNavigationIntentsState.getState()
      if (
        intent &&
        Date.now() - intent.createdAt <= navigationIntentLifetimeMs &&
        (!intent.targetUid || intent.targetUid === currentUid)
      ) {
        return openInitialLink(intent.url, handleAppLink)
      }

      const pushState = usePushState.getState()
      const showMonster =
        !pushState.justSignedUp && pushState.showPushPrompt && !pushState.hasPermissions

      let deepLinkUrl: string | null = null
      if (isMobile) {
        try {
          deepLinkUrl = await Linking.getInitialURL()
        } catch {}
      }

      const haveSavedTab = !!(startupTab || startupConversation)

      if (deepLinkUrl) {
        const normalized = normalizeUrl(deepLinkUrl)
        if (normalized) {
          return openInitialLink(normalized, handleAppLink)
        }
      }

      if (showMonster && !haveSavedTab) {
        return setInitialURLOnce('keybase://settingsPushPrompt')
      }

      if (androidShare && !haveSavedTab) {
        return setInitialURLOnce('keybase://incoming-share')
      }

      if (startupConversation) {
        return setInitialURLOnce(`keybase://convid/${startupConversation}`)
      }

      if (startupTab) {
        return setInitialURLOnce(`keybase://${startupTab}`)
      }

      return null
    },

  // Prevent React Navigation from updating window.location on Electron (file:// protocol).
  // On native this is a no-op since there's no browser URL to update.
  getPathFromState: () => '',

  getStateFromPath: customGetStateFromPath as LinkingOptions<RootParamList>['getStateFromPath'],

  prefixes: ['keybase://'],

  subscribe: (listener: (url: string) => void) => {
    const unsubscribeIntents = subscribeNavigationIntents(listener, handleAppLink)

    // On native, listen for RN Linking 'url' events (warm-start deep links)
    let removeLinkingSub: (() => void) | undefined
    if (isMobile) {
      const sub = Linking.addEventListener('url', ({url}: {url: string}) => {
        logger.info('[DeepLink] url event:', url)
        emitDeepLink(url)
      })
      removeLinkingSub = () => sub.remove()
    }

    return () => {
      unsubscribeIntents()
      removeLinkingSub?.()
    }
  },
  }
}
