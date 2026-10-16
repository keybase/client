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
// links: a share made then waits here, for this run only, and opens for whoever logs in next. The
// service hands the share out once, so it can't open a second time.
let heldShare: string | undefined

export const holdLoggedOutShare = (url: string | undefined) => {
  const share = url ? loggedOutShareToHold(url) : undefined
  if (!share) return
  if (useConfigState.getState().loggedIn) {
    emitDeepLink(share)
    return
  }
  logger.info('[DeepLink] holding a share until login')
  heldShare = share
}

export const releaseLoggedOutShare = () => {
  const share = heldShare
  heldShare = undefined
  if (share) {
    emitDeepLink(share)
  }
}
