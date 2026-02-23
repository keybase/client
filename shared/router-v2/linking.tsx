import * as Tabs from '@/constants/tabs'
import {isSplit} from '@/constants/chat/common'
import {isValidConversationIDKey} from '@/constants/types/chat/common'
import {isMobile} from '@/constants/platform'
import {useConfigState} from '@/stores/config'
import {usePushState} from '@/stores/push'
import type {LinkingOptions} from '@react-navigation/native'
import type {RootParamList} from './route-params'

// ---- URL normalization ----

// Convert https://keybase.io/ URLs to keybase:// URLs
const normalizeHttpUrl = (url: string): string | undefined => {
  const protocolEnd = url.indexOf('://')
  if (protocolEnd === -1) return undefined
  const protocol = url.substring(0, protocolEnd + 3)
  if (protocol !== 'http://' && protocol !== 'https://') return undefined

  const afterProtocol = url.substring(protocolEnd + 3)
  const slashIdx = afterProtocol.indexOf('/')
  const host = slashIdx === -1 ? afterProtocol : afterProtocol.substring(0, slashIdx)
  // Strip port for comparison
  const colonIdx = host.indexOf(':')
  const hostname = colonIdx === -1 ? host : host.substring(0, colonIdx)

  if (hostname !== 'keybase.io' && hostname !== 'www.keybase.io') return undefined

  const pathname = slashIdx === -1 ? '/' : afterProtocol.substring(slashIdx).split('?')[0]!

  // /team/someteam?applink=action
  const teamMatch = pathname.match(/^\/team\/((?:[a-zA-Z0-9][a-zA-Z0-9_.-]?)+)\/?$/)
  if (teamMatch?.[1]) {
    const teamName = teamMatch[1]
    const queryIdx = url.indexOf('?')
    const queryString = queryIdx === -1 ? '' : url.substring(queryIdx)
    const actionMatch = queryString.match(/[?&]applink=([a-z_]+)/)
    const action = actionMatch?.[1]
    return action
      ? `keybase://team-page/${teamName}/${action}`
      : `keybase://team-page/${teamName}`
  }

  // /username (single path segment)
  const userMatch = pathname.match(/^\/((?:[a-zA-Z0-9][a-zA-Z0-9_-]?)+)\/?$/)
  if (userMatch?.[1]) {
    const username = userMatch[1].toLowerCase()
    if (username !== 'app' && username.length >= 2 && username.length <= 16) {
      return `keybase://profile/show/${username}`
    }
  }

  return undefined
}

// Normalize any incoming URL to a keybase:// URL
export const normalizeUrl = (url: string): string | undefined => {
  if (url.startsWith('keybase://')) return url
  return normalizeHttpUrl(url)
}

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
    routes: [{name: 'loggedIn', state: {routes: [tabRoute]}}],
  }
}

// Build state for navigating to a chat conversation
export const makeChatConversationState = (conversationIDKey: string): PartialNavState => {
  if (isSplit) {
    // Tablet/desktop: chatRoot with conversationIDKey param (split view)
    return makeTabState(Tabs.chatTab, [{name: 'chatRoot', params: {conversationIDKey}}])
  }
  // Phone: chatRoot + chatConversation on stack
  return makeTabState(Tabs.chatTab, [
    {name: 'chatRoot'},
    {name: 'chatConversation', params: {conversationIDKey}},
  ])
}

// Build state for a modal screen at root level
const makeModalState = (modalName: string, params?: Record<string, unknown>): PartialNavState => ({
  index: 1,
  routes: [{name: 'loggedIn'}, {name: modalName, ...(params ? {params} : {})}],
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
        return makeTabState(Tabs.fsTab, [{name: 'fsRoot', params: {path: `/keybase/${decoded}`}}])
      } catch {}
      break
    }

    // keybase://incoming-share
    case 'incoming-share':
      return makeModalState('incomingShareNew')

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

// ---- Deep link emission ----

// Listener for programmatic deep link emission (e.g., from desktop IPC, engine events)
let _deepLinkListener: ((url: string) => void) | undefined

// Fallback handler for when no linking subscription is active (desktop).
// Set by createLinkingConfig.
let _fallbackHandler: ((link: string) => void) | undefined

// Emit a deep link URL from non-Linking sources (desktop IPC, engine notifications, etc.)
// On native (with linking config), routes through the linking subscription.
// On desktop (no linking config), falls back to handleAppLink.
export const emitDeepLink = (url: string) => {
  const normalized = normalizeUrl(url)
  if (!normalized) return
  if (_deepLinkListener) {
    _deepLinkListener(normalized)
  } else {
    _fallbackHandler?.(normalized)
  }
}

// ---- Linking config ----

export const createLinkingConfig = (
  handleAppLink: (link: string) => void
): LinkingOptions<RootParamList> => {
  _fallbackHandler = handleAppLink
  return {
    getInitialURL: async () => {
    // Compute the startup URL from saved state, push notifications, and deep links.
    // This replaces the manual NavigationState construction that was in useInitialState.
    const {loggedIn, startup, androidShare} = useConfigState.getState()
    if (!loggedIn) return null

    const {tab: startupTab, followUser: startupFollowUser} = startup
    let startupConversation = startup.conversation
    if (!isValidConversationIDKey(startupConversation)) {
      startupConversation = ''
    }

    const pushState = usePushState.getState()
    const showMonster =
      !pushState.justSignedUp && pushState.showPushPrompt && !pushState.hasPermissions

    // Check for an incoming deep link URL (native only)
    let deepLinkUrl: string | null = null
    if (isMobile) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const RN: {Linking: {getInitialURL: () => Promise<string | null>}} = require('react-native')
        deepLinkUrl = await RN.Linking.getInitialURL()
      } catch {}
    }

    const haveSavedTab = !!(startupTab || startupConversation)

    // Deep link URL takes priority
    if (deepLinkUrl) {
      const normalized = normalizeUrl(deepLinkUrl)
      if (normalized) {
        if (isHandledByLinkingConfig(normalized)) return normalized
        // URL not handled by linking config; use imperative navigation as fallback
        setTimeout(() => handleAppLink(normalized), 1)
        return null
      }
    }

    // Push permission prompt (if no saved state to restore)
    if (showMonster && !haveSavedTab) {
      return 'keybase://settingsPushPrompt'
    }

    // Android share intent (if no saved state to restore)
    if (androidShare && !haveSavedTab) {
      return 'keybase://incoming-share'
    }

    // Push notification follow user
    if (startupFollowUser && !startupConversation) {
      return `keybase://profile/show/${startupFollowUser}`
    }

    // Saved conversation from last session
    if (startupConversation) {
      return `keybase://convid/${startupConversation}`
    }

    // Saved tab from last session
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
    // Set up the programmatic deep link listener
    _deepLinkListener = (url: string) => {
      if (isHandledByLinkingConfig(url)) {
        listener(url)
      } else {
        handleAppLink(url)
      }
    }

    // On native, listen for RN Linking 'url' events (warm-start deep links)
    let removeLinkingSub: (() => void) | undefined
    if (isMobile) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const RN: {Linking: {addEventListener: (type: string, handler: (e: {url: string}) => void) => {remove: () => void}}} = require('react-native')
        const {Linking} = RN
        const sub = Linking.addEventListener('url', ({url}: {url: string}) => {
          const normalized = normalizeUrl(url)
          if (!normalized) return
          if (isHandledByLinkingConfig(normalized)) {
            listener(normalized)
          } else {
            handleAppLink(normalized)
          }
        })
        removeLinkingSub = () => sub.remove()
      } catch {}
    }

    return () => {
      _deepLinkListener = undefined
      removeLinkingSub?.()
    }
  },
  }
}
