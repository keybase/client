import * as T from '@/constants/types'
import {ackIncomingShare, peekIncomingShare} from 'react-native-kb'
import {emitDeepLink} from '@/router-v2/deep-link-emitter'
import {useConfigState} from '@/stores/config'
import {useNavigationIntentsState} from '@/stores/navigation-intents'

// Android shares live in native (IncomingShareRelay) until a share screen is done with them; JS
// keeps no copy, so nothing JS drops or resets can lose one. JS only makes sure the share native
// holds has a screen: whenever there is no screen for it in the current navigator and nothing else
// is waiting to navigate, it opens the share's link. The screen reads the share by the id its link
// names and acks it when its route is removed, which is the only way a share is done with.

// The link that opens an Android share. It names the share, so the screen it opens knows which
// share is its own.
export const androidShareURL = (id: number) => `keybase://incoming-share?androidShare=${id}`

// The share native holds, by the id it last told us.
let heldShareID: number | undefined
// The share a screen in the current navigator is for. A screen paused under another keeps it.
let shownShareID: number | undefined

const openHeldShare = () => {
  if (heldShareID === undefined || heldShareID === shownShareID) return
  const {loggedIn, userSwitching} = useConfigState.getState()
  const {intent, navigationReady} = useNavigationIntentsState.getState()
  if (!loggedIn || userSwitching || !navigationReady || intent) return
  emitDeepLink(androidShareURL(heldShareID))
}

export const onAndroidShareHeld = (id: number) => {
  heldShareID = id
  openHeldShare()
}

// A new navigator has no screens, so whatever share is held needs one again.
export const onAndroidShareNavigatorReady = () => {
  shownShareID = undefined
  openHeldShare()
}

export const subscribeAndroidShareOpener = () => {
  const unsubIntents = useNavigationIntentsState.subscribe(openHeldShare)
  const unsubConfig = useConfigState.subscribe(openHeldShare)
  return () => {
    unsubIntents()
    unsubConfig()
  }
}

// A share screen is showing the share with this id.
export const androidShareShown = (id: number) => {
  shownShareID = id
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

export const finishAndroidShare = (id: number) => {
  ackIncomingShare(id)
  if (heldShareID === id) heldShareID = undefined
  if (shownShareID === id) shownShareID = undefined
}

export const resetAndroidShareForTest = () => {
  heldShareID = undefined
  shownShareID = undefined
}
