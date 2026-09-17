import logger from '@/logger'
import {useNavigationIntentsState} from '@/stores/navigation-intents'

// Deep-link emission + URL normalization. Kept separate from './linking'
// (which imports the config/push/current-user stores) so stores/push can enqueue
// navigation without importing the router's linking config.

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

// Records the URL and returns it so callers can `return setInitialURLOnce(url)`.
export const setInitialURLOnce = (url: string) => {
  useNavigationIntentsState.getState().dispatch.markInitialURLHandled(url)
  return url
}

// Producers only enqueue navigation intent. The active router consumes it once
// the intended account is active and its NavigationContainer is ready.
//
// A link here can come from any app, web page or typed URL, so it never carries
// a targetUid: only enqueuePushTap may target (and so switch) an account.
export const emitDeepLink = (url: string) => {
  const normalized = normalizeUrl(url)
  if (!normalized) return
  useNavigationIntentsState.getState().dispatch.enqueue(normalized)
}

// ---- Notification taps ----

// Where a tap on a notification with this payload opens, or undefined when the
// tap only opens the app. `targetUid` names the account the notification is for.
export const pushTapTarget = (payload: string): {url: string; targetUid?: string} | undefined => {
  let parsed: unknown
  try {
    parsed = JSON.parse(payload)
  } catch {
    return undefined
  }
  if (typeof parsed !== 'object' || parsed === null) return undefined
  const fields = parsed as Record<string, unknown>
  const get = (key: string): string => {
    const value = fields[key]
    if (typeof value === 'string') return value
    if (typeof value === 'number') return String(value)
    return ''
  }
  const forAccount = (url: string, uid: string) => (uid ? {targetUid: uid, url} : {url})

  switch (get('type')) {
    case 'chat.newmessage': {
      const convID = get('convID')
      return convID ? forAccount(`keybase://convid/${encodeURIComponent(convID)}`, get('uid')) : undefined
    }
    case 'follow': {
      const username = get('username')
      return username
        ? forAccount(
            `keybase://profile/show/${encodeURIComponent(username)}`,
            get('uid') || get('targetUID')
          )
        : undefined
    }
    case 'device.new':
    case 'device.revoked': {
      const uid = get('uid')
      return uid ? forAccount('keybase://devices', uid) : undefined
    }
    // Nothing to open: these are handled natively and in Go.
    case 'chat.readmessage':
    case 'chat.newmessageSilent_2':
    case 'autoreset':
    case 'chat.extension':
    case 'chat.failedpending':
      return undefined
    default:
      return get('message').startsWith('Your contact') ? {url: 'keybase://tabs.peopleTab'} : undefined
  }
}

// For payloads from native's notification-tap channel only (see
// constants/init/push-listener.native). A targetUid marks an intent as a tap,
// and nothing else can set one, so no link another app opens can switch accounts.
export const enqueuePushTap = (payload: string) => {
  const target = pushTapTarget(payload)
  if (!target) {
    logger.info('[PushTap] took a tap with nothing to open')
    return
  }
  logger.info('[PushTap] took a tap link:', target.url)
  useNavigationIntentsState.getState().dispatch.enqueue(target.url, {targetUid: target.targetUid})
}
