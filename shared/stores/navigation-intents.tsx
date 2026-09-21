import * as T from '@/constants/types'
import * as Z from '@/util/zustand'
import logger from '@/logger'

export type NavigationIntentOptions = {
  pushTapID?: number
  targetUid?: string
}

type NavigationIntent = {
  createdAt: number
  id: number
  pushTapID?: number
  targetUid?: string
  url: string
}

type HandledIntent = {
  handledAt: number
  targetUid?: string
  url: string
}

type Store = {
  intent?: NavigationIntent
  lastHandledIntent?: HandledIntent
  navigationReady: boolean
  navigationReadyForUid?: string
  dispatch: {
    acknowledge: (id: number) => void
    enqueue: (url: string, options?: NavigationIntentOptions) => void
    markInitialURLHandled: (url: string) => void
    resetState: () => void
    setNavigationReady: (ready: boolean, uid?: string) => void
  }
}

const duplicateWindowMs = 1500

// A push tap's Go-side route is retired by an explicit ack, not by anything here clearing the
// intent. Once an id has been queued, remembering it for the rest of the process is what keeps a
// lost-ack redelivery (the route stays armed; see constants/init/shared's drainPushTapRoute) from
// enqueuing -- and so navigating -- a second time. Module state, not store state: it must survive
// resetState, which runs on every account switch this process makes.
//
// Structural rule: every pushTapID that leaves s.intent -- consumed, merged away, superseded by a
// different pending intent, or discarded outright -- goes through ackPushTap exactly once. A route
// left dangling here is a route the service will hand back on the next peek, navigating (or
// failing to navigate) on a tap the app has already moved past.
const seenPushTapIDs = new Set<number>()

const sendPushTapAck = (pushTapID: number) => {
  T.RPCGen.appStateAckPushTapRouteRpcPromise({id: pushTapID}).catch((error: unknown) => {
    logger.warn('[PushTap] failed to ack a consumed tap route: ', error)
  })
}

// Fires the ack once per id, regardless of how many times consumption is reported for it. A
// redelivery of an id already in the set (the route is still armed, so that first ack did not
// land) is retried directly by enqueue, not through here.
const ackPushTap = (pushTapID: number | undefined) => {
  if (pushTapID === undefined || seenPushTapIDs.has(pushTapID)) return
  seenPushTapIDs.add(pushTapID)
  sendPushTapAck(pushTapID)
}

export const useNavigationIntentsState = Z.createZustand<Store>(
  'navigation-intents',
  (set, get) => {
    let nextIntentID = 0
    const dispatch: Store['dispatch'] = {
      acknowledge: id => {
        const intent = get().intent
        if (intent?.id !== id) return
        set(s => {
          s.lastHandledIntent = {
            handledAt: Date.now(),
            targetUid: intent.targetUid,
            url: intent.url,
          }
          s.intent = undefined
        })
        ackPushTap(intent.pushTapID)
      },
      enqueue: (url, options) => {
        const now = Date.now()
        const {pushTapID, targetUid} = options ?? {}
        const {intent: pending, lastHandledIntent} = get()

        if (pushTapID !== undefined) {
          if (pending?.pushTapID === pushTapID) {
            // Still queued, waiting on the exact thing this call is asking for.
            return
          }
          if (seenPushTapIDs.has(pushTapID)) {
            // The route is still armed on the service, so the ack that was supposed to retire
            // it did not land. Retry it; nothing here re-enqueues, since this id already left
            // the store once and must not navigate a second time.
            sendPushTapAck(pushTapID)
            return
          }
        }

        if (
          pending?.url === url &&
          (!pending.targetUid || !targetUid || pending.targetUid === targetUid)
        ) {
          const targetUidChanged = !pending.targetUid && !!targetUid
          // pushTapID is guaranteed different from pending.pushTapID here (equal is caught
          // above), so this always means the service replaced the route this intent already
          // carries with a newer one -- adopt its id so the eventual ack retires the route
          // that is actually still armed, rather than one already gone.
          const pushTapIDChanged = pushTapID !== undefined
          if (targetUidChanged || pushTapIDChanged) {
            set(s => {
              if (s.intent?.id !== pending.id) return
              if (targetUidChanged) {
                s.intent.targetUid = targetUid
              }
              if (pushTapIDChanged) {
                s.intent.pushTapID = pushTapID
              }
            })
          }
          return
        }

        // Once an unscoped URL has been handled, a later targeted URL carries new
        // account-routing information and must not be discarded. The reverse ordering
        // is safe: an unscoped event after a targeted one can be the duplicate source.
        if (
          lastHandledIntent?.url === url &&
          now - lastHandledIntent.handledAt < duplicateWindowMs &&
          (!targetUid || lastHandledIntent.targetUid === targetUid)
        ) {
          // Navigation for this URL just happened; a tap riding along has nothing left to wait
          // for, so it acks immediately instead of waiting on a consumption that isn't coming.
          ackPushTap(pushTapID)
          return
        }

        // A different pending intent is replaced outright rather than merged (see above), so
        // its own tap -- if it carries one, and whether or not the service has already
        // discarded that route for the one replacing it -- is given up on for good here.
        ackPushTap(pending?.pushTapID)

        const id = ++nextIntentID
        set(s => {
          s.intent = {
            createdAt: now,
            id,
            pushTapID,
            targetUid,
            url,
          }
        })
      },
      markInitialURLHandled: url => {
        const pending = get().intent
        const matchingPending = pending?.url === url ? pending : undefined
        set(s => {
          if (matchingPending) {
            s.intent = undefined
          }
          s.lastHandledIntent = {
            handledAt: Date.now(),
            targetUid: matchingPending?.targetUid,
            url,
          }
        })
        ackPushTap(matchingPending?.pushTapID)
      },
      // Account changes call resetAllStores. Keep account-targeted navigation
      // across the reset, but discard unscoped work from the previous session.
      resetState: () => {
        const intent = get().intent
        const discarding = !intent?.targetUid
        set(s => {
          if (!s.intent?.targetUid) {
            s.intent = undefined
          }
          s.lastHandledIntent = undefined
          s.navigationReady = false
          s.navigationReadyForUid = undefined
        })
        if (discarding) {
          ackPushTap(intent?.pushTapID)
        }
      },
      setNavigationReady: (ready, uid) => {
        set(s => {
          s.navigationReady = ready
          // Only onReady supplies a UID. Callback-ref detach/reattach events
          // update readiness without assigning the old container to a new user.
          if (uid !== undefined) {
            s.navigationReadyForUid = uid
          }
        })
      },
    }

    return {
      dispatch,
      intent: undefined,
      lastHandledIntent: undefined,
      navigationReady: false,
      navigationReadyForUid: undefined,
    }
  }
)
