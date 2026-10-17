import logger from '@/logger'
import {useConfigState} from '@/stores/config'
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

// Logged out, the router has no linking config, so nothing reads the launch URL or listens for
// links, and logging in keeps the same navigation container, which reads its launch URL only when
// it mounts. So a share that arrives while logged out, in the link that launched the app or a later
// one, waits here, for this run only, and opens once someone logs in: it only opens the user's own
// share, which still needs a conversation picked and Send. Any other link is dropped.
let shareHeld = false

export const holdLoggedOutLink = (url: string | undefined) => {
  if (!url) return
  const share = loggedOutShareToHold(url)
  if (useConfigState.getState().loggedIn) {
    emitDeepLink(share ?? url)
    return
  }
  if (!share) {
    logger.info('[DeepLink] dropping a link that arrived while logged out')
    return
  }
  logger.info('[DeepLink] holding a share until login')
  shareHeld = true
}

export const releaseLoggedOutLink = () => {
  if (!shareHeld) return
  shareHeld = false
  emitDeepLink(incomingShareURL)
}
