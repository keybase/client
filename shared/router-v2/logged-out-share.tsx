import logger from '@/logger'
import {useConfigState} from '@/stores/config'
import {emitDeepLink, normalizeUrl} from './deep-link-emitter'

const incomingShareURL = 'keybase://incoming-share'

// What a share link that arrives while logged out becomes once someone logs in: the share without
// its conversation. That conversation was suggested by whichever account was signed in when the
// sheet was built, and the next login may not be it, so the user picks one in the share screen.
// Anything else isn't held, as before.
export const loggedOutShareToHold = (url: string): string | undefined => {
  const normalized = normalizeUrl(url)
  if (!normalized?.startsWith(incomingShareURL)) return undefined
  const rest = normalized.slice(incomingShareURL.length)
  return rest === '' || rest.startsWith('/') || rest.startsWith('?') ? incomingShareURL : undefined
}

// Logged out, the router has no linking config, so nothing reads the launch URL or listens for
// links, and logging in keeps the same navigation container, which reads its launch URL only when
// it mounts. So the link that launched the app, of any kind, and a share made while logged out wait
// here, for this run only, and open for whoever logs in next. One waits at a time: the latest.
let heldLink: string | undefined

const holdLink = (link: string | undefined) => {
  if (!link) return
  if (useConfigState.getState().loggedIn) {
    emitDeepLink(link)
    return
  }
  logger.info('[DeepLink] holding a link until login')
  heldLink = link
}

export const holdLoggedOutLaunchLink = (url: string | undefined) =>
  holdLink(url ? (loggedOutShareToHold(url) ?? normalizeUrl(url)) : undefined)

export const holdLoggedOutShare = (url: string | undefined) =>
  holdLink(url ? loggedOutShareToHold(url) : undefined)

export const releaseLoggedOutShare = () => {
  const link = heldLink
  heldLink = undefined
  if (link) {
    emitDeepLink(link)
  }
}
