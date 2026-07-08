// Dependency-free deep-link emitter + URL normalization. Kept separate from
// './linking' (which imports the config/push/current-user stores) so that
// stores/push -> deep-link-emitter stays acyclic (push only needs emitDeepLink,
// not the whole linking config). See the push <-> linking require cycle.

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

// ---- Deep link emission ----

// Listener for programmatic deep link emission (e.g., from desktop IPC, engine events)
let _deepLinkListener: ((url: string) => void) | undefined

// Fallback handler for when no linking subscription is active (desktop).
// Set by createLinkingConfig.
let _fallbackHandler: ((link: string) => void) | undefined

// URL returned by getInitialURL, used to deduplicate cold-start push notifications.
// On cold start from a push tap, the same notification is processed by both
// getInitialURL (via startupConversation) and the push listener (via handlePush).
// This prevents the second navigation.
let _initialURLOnce: string | undefined

export const setDeepLinkFallback = (h: (link: string) => void) => {
  _fallbackHandler = h
}
export const setDeepLinkListener = (l: ((url: string) => void) | undefined) => {
  _deepLinkListener = l
}
// Records the URL and returns it so callers can `return setInitialURLOnce(url)`.
export const setInitialURLOnce = (url: string) => {
  _initialURLOnce = url
  return url
}

// Emit a deep link URL from non-Linking sources (desktop IPC, engine notifications, etc.)
// On native (with linking config), routes through the linking subscription.
// On desktop (no linking config), falls back to handleAppLink.
export const emitDeepLink = (url: string) => {
  const normalized = normalizeUrl(url)
  if (!normalized) return
  if (_initialURLOnce && _initialURLOnce === normalized) {
    _initialURLOnce = undefined
    return
  }
  if (_deepLinkListener) {
    _deepLinkListener(normalized)
  } else {
    _fallbackHandler?.(normalized)
  }
}
