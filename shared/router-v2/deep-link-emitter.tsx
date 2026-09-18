import logger from '@/logger'
import {useNavigationIntentsState} from '@/stores/navigation-intents'

// Deep-link emission + URL normalization. Kept separate from './linking' so
// stores/push can enqueue navigation without importing the router's linking config
// (which pulls in the config/push/current-user stores and the route tables). This
// leaf depends on the navigation-intents store and nothing else.

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

  // /phone-app — the install link our own chat invite banner texts to an unresolved @phone
  // participant (chat/conversation/bottom-banner.tsx). It is not a username, so it has to be
  // carved out ahead of the single-segment rule below, which would otherwise open a profile
  // for a user that does not exist. It always opens Add Phone Number: the invitee's inviter
  // wrote to a number, and nothing here knows (or waits to learn) whether they have one.
  if (pathname === '/phone-app' || pathname === '/phone-app/') {
    return 'keybase://settingsAddPhone'
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

// Records the URL and returns it so callers can `return setInitialURLOnce(url)`.
export const setInitialURLOnce = (url: string) => {
  useNavigationIntentsState.getState().dispatch.markInitialURLHandled(url)
  return url
}

// Producers only enqueue navigation intent. The active router consumes it once
// the intended account is active and its NavigationContainer is ready.
//
// A link here can come from any app, web page or typed URL, so it never carries
// a targetUid: only enqueuePushTapRoute may target (and so switch) an account.
export const emitDeepLink = (url: string) => {
  const normalized = normalizeUrl(url)
  if (!normalized) return
  useNavigationIntentsState.getState().dispatch.enqueue(normalized)
}

// ---- Notification taps ----

// For routes read from the service's pending-tap holder only (see
// constants/init/shared). The service fills that holder from its push-tap bind
// verb and nothing else, so a targetUID here can only have come from a real
// notification tap, and no link another app opens can switch accounts.
export const enqueuePushTapRoute = (route: {url: string; targetUID: string}) => {
  logger.info('[PushTap] queued a tap link:', route.url)
  useNavigationIntentsState
    .getState()
    .dispatch.enqueue(route.url, {targetUid: route.targetUID || undefined})
}
