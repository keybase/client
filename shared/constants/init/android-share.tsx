import * as T from '@/constants/types'
import * as Tabs from '@/constants/tabs'
import logger from '@/logger'
import {getNavigator, navigationRef} from '@/constants/navigator'
import {ackIncomingShare, peekIncomingShare} from 'react-native-kb'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {useNavigationIntentsState} from '@/stores/navigation-intents'
import {useRouterState} from '@/stores/router'

// Android shares live in native (IncomingShareRelay) until JS is done with them; JS keeps no copy,
// so nothing JS drops or resets can lose one. Whether a share is shown, and when it is done with,
// both come from one place, the current navigator's state: a share is shown while a route in it
// names the share's id, and done with when such a route leaves it. A screen paused under pushed
// screens is still in the state, and clearModals or a reset takes it out. A navigator torn down
// (an account switch, the app's surface going away) is not the user leaving the share, so its
// shares are not done with: the next navigator opens them again. A new navigator is told apart by
// its container, so its first state is never compared with an older navigator's. A logout does end
// a held share: whoever logs in next may not be who it was shared to.

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
// The navigator (its container) whose state was seen last, and the shares its routes are for.
let navigator: unknown
let navigatorShareIDs = new Set<number>()
// A share navigated to and not yet in a reported state. The navigation is a reset or a push of a
// registered route, which always commits a new state, so the next state report settles it.
let openingShareID: number | undefined

const finishAndroidShare = (id: number) => {
  logger.info(`[AndroidShare] done with share ${id}`)
  ackIncomingShare(id)
  if (heldShareID === id) heldShareID = undefined
}

const openHeldShare = () => {
  const id = heldShareID
  if (id === undefined || navigatorShareIDs.has(id) || openingShareID === id) return
  const {loggedIn, userSwitching} = useConfigState.getState()
  const {intent, navigationReady} = useNavigationIntentsState.getState()
  // A link or tap about to navigate this account goes first, and the share opens once it has: its
  // consumption changes the store, which runs this again. One waiting on a switch to another
  // account doesn't hold the share up.
  const uid = useCurrentUserState.getState().uid
  const waiting = !!intent && (!intent.targetUid || intent.targetUid === uid)
  if (!loggedIn || userSwitching || !navigationReady || waiting) return
  const navigator = getNavigator()
  const routes = navigator.getRootState()?.routes ?? []
  // The share screen is one of the logged-in screens: until they are in the state (just after
  // login) a navigation to it would go nowhere. Their arrival is a state report, which runs this.
  if (!routes.some(r => r.name === 'loggedIn')) return
  // As a share link does on iOS: the chat tab is parked under the share, which always ends in chat,
  // in place of whatever was up.
  if (navigator.showAboveTabs(Tabs.chatTab, {name: 'incomingShareNew', params: {androidShareID: id}})) {
    logger.info(`[AndroidShare] opening share ${id}`)
    openingShareID = id
  }
}

const onNavState = (state: StateLike) => {
  // No state is no navigator to compare: nothing was left, and nothing is shown.
  if (!state) return
  const next = shareIDsIn(state)
  const current = navigationRef.current
  // Logging out, and starting an account switch, reset loggedIn before the navigator empties.
  if (current === navigator && useConfigState.getState().loggedIn) {
    for (const id of navigatorShareIDs) {
      if (!next.has(id)) finishAndroidShare(id)
    }
  }
  navigator = current
  navigatorShareIDs = next
  openingShareID = undefined
  openHeldShare()
}

type SignInState = {loggedIn: boolean; userSwitching: boolean}
const loggedOutForGood = (s: SignInState) => !s.loggedIn && !s.userSwitching

const onConfig = (s: SignInState, old: SignInState) => {
  // An account switch sets userSwitching before it logs the old account out, so landing logged out
  // and not switching is a logout, or a switch that never reached its account.
  if (loggedOutForGood(s) && !loggedOutForGood(old) && heldShareID !== undefined) {
    finishAndroidShare(heldShareID)
  }
  openHeldShare()
}

export const onAndroidShareHeld = (id: number) => {
  heldShareID = id
  openHeldShare()
}

export const subscribeAndroidShareOpener = () => {
  const unsubs = [
    useRouterState.subscribe((s, old) => {
      if (s.navState !== old.navState) onNavState(s.navState as StateLike)
    }),
    useNavigationIntentsState.subscribe(openHeldShare),
    useConfigState.subscribe(onConfig),
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
  navigator = undefined
  navigatorShareIDs = new Set()
  openingShareID = undefined
}
