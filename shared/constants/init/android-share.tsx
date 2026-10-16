import * as T from '@/constants/types'
import {ackIncomingShare, peekIncomingShare} from 'react-native-kb'
import {emitDeepLink} from '@/router-v2/deep-link-emitter'
import {useConfigState} from '@/stores/config'
import {useNavigationIntentsState} from '@/stores/navigation-intents'
import {useRouterState} from '@/stores/router'

// Android shares live in native (IncomingShareRelay) until JS is done with them; JS keeps no copy,
// so nothing JS drops or resets can lose one. Whether a share is shown, and when it is done with,
// both come from one place, the current navigator's state: a share is shown while a route in it
// names the share's id, and done with when such a route leaves it. A screen paused under pushed
// screens is still in the state, and clearModals or a reset takes it out. A navigator torn down
// (logout, account switch, the app's surface going away) is not the user leaving the share, so its
// shares are not done with: the next navigator opens them again.

// The link that opens an Android share. It names the share, so the screen it opens knows which
// share is its own.
export const androidShareURL = (id: number) => `keybase://incoming-share?androidShare=${id}`

type StateLike = {routes?: ReadonlyArray<{params?: object; state?: StateLike}>} | undefined

const shareIDsIn = (state: StateLike, ids = new Set<number>()) => {
  for (const route of state?.routes ?? []) {
    const id = (route.params as {androidShareID?: unknown} | undefined)?.androidShareID
    if (typeof id === 'number') ids.add(id)
    shareIDsIn(route.state, ids)
  }
  return ids
}

// The share native holds, by the id it last told us.
let heldShareID: number | undefined
// The shares routes in the current navigator's state are for.
let navigatorShareIDs = new Set<number>()
// The link this navigator was sent for the held share and hasn't shown yet, and how many were sent.
// Each link sent is new (open=<n>): the intents store drops a link it just followed, and a new
// navigator may need the same share's link again within that window.
let issuedURL: string | undefined
let issuedCount = 0

const finishAndroidShare = (id: number) => {
  ackIncomingShare(id)
  if (heldShareID === id) heldShareID = undefined
}

const openHeldShare = () => {
  if (heldShareID === undefined || navigatorShareIDs.has(heldShareID)) return
  const {intent, lastHandledIntent, navigationReady} = useNavigationIntentsState.getState()
  // Sent already: wait for the state to show it, unless it was dropped before it was followed.
  if (
    issuedURL?.startsWith(`${androidShareURL(heldShareID)}&`) &&
    (intent?.url === issuedURL || lastHandledIntent?.url === issuedURL)
  ) {
    return
  }
  const {loggedIn, userSwitching} = useConfigState.getState()
  if (!loggedIn || userSwitching || !navigationReady || intent) return
  issuedURL = `${androidShareURL(heldShareID)}&open=${++issuedCount}`
  emitDeepLink(issuedURL)
}

const onNavState = (state: StateLike) => {
  const next = shareIDsIn(state)
  // Logging out, and starting an account switch, reset loggedIn before the navigator empties.
  if (state && useConfigState.getState().loggedIn) {
    for (const id of navigatorShareIDs) {
      if (!next.has(id)) finishAndroidShare(id)
    }
  } else {
    issuedURL = undefined
  }
  navigatorShareIDs = next
  openHeldShare()
}

export const onAndroidShareHeld = (id: number) => {
  heldShareID = id
  openHeldShare()
}

// A new navigator starts with no routes, and the old one's going doesn't count as leaving them.
// Called before the new navigator reports its first state.
export const onAndroidShareNavigatorReady = () => {
  navigatorShareIDs = new Set()
  issuedURL = undefined
}

export const subscribeAndroidShareOpener = () => {
  const unsubs = [
    useRouterState.subscribe((s, old) => {
      if (s.navState !== old.navState) onNavState(s.navState as StateLike)
    }),
    useNavigationIntentsState.subscribe(openHeldShare),
    useConfigState.subscribe(openHeldShare),
  ]
  return () => unsubs.forEach(u => u())
}

// The share's items for the share screen, or undefined once native no longer holds it.
export const readAndroidShare = (
  id: number
): {droppedCount: number; items: ReadonlyArray<T.RPCGen.IncomingShareItem>} | undefined => {
  const share = peekIncomingShare(id)
  if (!share) return undefined
  const items = share.localPaths
    ? share.localPaths.map(originalPath => ({originalPath, type: T.RPCGen.IncomingShareType.file}))
    : share.text
      ? [{content: share.text, type: T.RPCGen.IncomingShareType.text}]
      : []
  return {droppedCount: share.droppedCount, items}
}

export const resetAndroidShareForTest = () => {
  heldShareID = undefined
  navigatorShareIDs = new Set()
  issuedURL = undefined
}
