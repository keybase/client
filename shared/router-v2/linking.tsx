import * as Tabs from '@/constants/tabs'
import {isSplit} from '@/constants/chat/layout'
import {isValidConversationIDKey, stringToConversationIDKey} from '@/constants/types/chat/common'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {usePushState} from '@/stores/push'
import type {LinkingOptions} from '@react-navigation/native'
import type {RootParamList} from './route-params'
import {Linking} from 'react-native'
import {
  normalizeUrl,
  setDeepLinkFallback,
  setDeepLinkListener,
  setInitialURLOnce,
} from './deep-link-emitter'
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

export const createLinkingConfig = (
  handleAppLink: (link: string) => void
): LinkingOptions<RootParamList> => {
  setDeepLinkFallback(handleAppLink)
  return {
    getInitialURL: async () => {
      const {loggedIn, startup, androidShare} = useConfigState.getState()
      if (!loggedIn) return null

      const {tab: startupTab, followUser: startupFollowUser} = startup
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
          if (isHandledByLinkingConfig(normalized)) return normalized
          // URL not handled by linking config; use imperative navigation as fallback
          setTimeout(() => handleAppLink(normalized), 1)
          return null
        }
      }

      if (showMonster && !haveSavedTab) {
        return 'keybase://settingsPushPrompt'
      }

      if (androidShare && !haveSavedTab) {
        return 'keybase://incoming-share'
      }

      if (startupFollowUser && !startupConversation) {
        return setInitialURLOnce(`keybase://profile/show/${startupFollowUser}`)
      }

      if (startupConversation) {
        return setInitialURLOnce(`keybase://convid/${startupConversation}`)
      }

      if (startupTab) {
        return `keybase://${startupTab}`
      }

      return null
    },

  // Prevent React Navigation from updating window.location on Electron (file:// protocol).
  // On native this is a no-op since there's no browser URL to update.
  getPathFromState: () => '',

  getStateFromPath: customGetStateFromPath as LinkingOptions<RootParamList>['getStateFromPath'],

  prefixes: ['keybase://'],

  subscribe: (listener: (url: string) => void) => {
    // Deduplicate rapid calls to listener from multiple sources (e.g., push handler
    // via emitDeepLink AND RN Linking 'url' event both firing for the same push tap).
    let _lastUrl: string | undefined
    let _lastTime = 0
    const dedupedListener = (url: string) => {
      const now = Date.now()
      if (url === _lastUrl && now - _lastTime < 1500) return
      _lastUrl = url
      _lastTime = now
      listener(url)
    }

    // Set up the programmatic deep link listener
    setDeepLinkListener((url: string) => {
      // Profile deep links need imperative navigation to properly set up
      // the back stack. State-based linking may not create intermediate screens.
      if (url.startsWith('keybase://profile/')) {
        handleAppLink(url)
        return
      }
      if (isHandledByLinkingConfig(url)) {
        dedupedListener(url)
      } else {
        handleAppLink(url)
      }
    })

    // On native, listen for RN Linking 'url' events (warm-start deep links)
    let removeLinkingSub: (() => void) | undefined
    if (isMobile) {
      const sub = Linking.addEventListener('url', ({url}: {url: string}) => {
        const normalized = normalizeUrl(url)
        if (!normalized) return
        // Profile deep links need imperative navigation to properly set up
        // the back stack. State-based linking may not create intermediate screens.
        if (normalized.startsWith('keybase://profile/')) {
          handleAppLink(normalized)
          return
        }
        if (isHandledByLinkingConfig(normalized)) {
          dedupedListener(normalized)
        } else {
          handleAppLink(normalized)
        }
      })
      removeLinkingSub = () => sub.remove()
    }

    return () => {
      setDeepLinkListener(undefined)
      removeLinkingSub?.()
    }
  },
  }
}
