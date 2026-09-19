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
const seenPushTapIDs = new Set<number>()

// Fires the ack once per id, regardless of how many times consumption is reported for it.
const ackPushTap = (pushTapID: number | undefined) => {
  if (pushTapID === undefined || seenPushTapIDs.has(pushTapID)) return
  seenPushTapIDs.add(pushTapID)
  T.RPCGen.appStateAckPushTapRouteRpcPromise({id: pushTapID}).catch((error: unknown) => {
    logger.warn('[PushTap] failed to ack a consumed tap route: ', error)
  })
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
        if (pushTapID !== undefined && (pending?.pushTapID === pushTapID || seenPushTapIDs.has(pushTapID))) {
          return
        }
        if (
          pending?.url === url &&
          (!pending.targetUid || !targetUid || pending.targetUid === targetUid)
        ) {
          if (!pending.targetUid && targetUid) {
            set(s => {
              if (s.intent?.id === pending.id) {
                s.intent.targetUid = targetUid
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
          return
        }
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
        set(s => {
          if (!s.intent?.targetUid) {
            s.intent = undefined
          }
          s.lastHandledIntent = undefined
          s.navigationReady = false
          s.navigationReadyForUid = undefined
        })
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
