import logger from '@/logger'
import {useConfigState} from '@/stores/config'
import {navigationIntentLifetimeMs} from '@/stores/navigation-intents'
import {emitDeepLink, normalizeUrl} from './deep-link-emitter'

const incomingShareURL = 'keybase://incoming-share'

// What a share link that arrives while logged out becomes once someone logs in: the share without
// its conversation. That conversation was suggested by whichever account was signed in when the
// sheet was built, and the next login may not be it, so the user picks one in the share screen.
export const loggedOutShareToHold = (url: string): string | undefined => {
  const normalized = normalizeUrl(url)
  if (!normalized?.startsWith(incomingShareURL)) return undefined
  const rest = normalized.slice(incomingShareURL.length)
  return rest === '' || rest.startsWith('/') || rest.startsWith('?') ? incomingShareURL : undefined
}

// The links that only take the user somewhere: anything they do from there asks first. Others, a
// chat link that creates the conversation it names among them, must not run later, out of
// context, in whichever account logs in.
const navigationOnlyLinks = new Set([
  'convid',
  'devices',
  'private',
  'profile',
  'public',
  'settingsAddPhone',
  'team',
  'team-invite-link',
  'team-page',
])
const onlyNavigates = (link: string) =>
  navigationOnlyLinks.has(link.slice('keybase://'.length).split(/[/?#]/)[0] ?? '')

// Logged out, the router has no linking config, so nothing reads the launch URL or listens for
// links, and logging in keeps the same navigation container, which reads its launch URL only when
// it mounts. So a link that arrives while logged out, the one that launched the app or a later one,
// waits here, for this run only, and opens for whoever logs in next. One waits at a time: the
// latest. A share waits until login: it only opens the user's own share, which still needs a
// conversation picked and Send. A link that only navigates waits as long as a navigation intent
// lives, counted from when it arrived. Any other link isn't held, and doesn't replace a held share.
let heldLink: {link: string; receivedAt?: number} | undefined

export const holdLoggedOutLink = (url: string | undefined) => {
  if (!url) return
  const share = loggedOutShareToHold(url)
  const link = share ?? normalizeUrl(url)
  if (!link) return
  if (useConfigState.getState().loggedIn) {
    emitDeepLink(link)
    return
  }
  if (share) {
    logger.info('[DeepLink] holding a share until login')
    heldLink = {link}
    return
  }
  if (!onlyNavigates(link)) {
    logger.info('[DeepLink] dropping a link that arrived while logged out')
    if (heldLink?.receivedAt !== undefined) heldLink = undefined
    return
  }
  logger.info('[DeepLink] holding a link until login')
  heldLink = {link, receivedAt: Date.now()}
}

export const releaseLoggedOutLink = () => {
  const held = heldLink
  heldLink = undefined
  if (!held) return
  if (held.receivedAt !== undefined && Date.now() - held.receivedAt > navigationIntentLifetimeMs) {
    logger.info('[DeepLink] dropping a link held too long before login')
    return
  }
  emitDeepLink(held.link, held.receivedAt)
}
