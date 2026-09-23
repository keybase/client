import * as Z from '@/util/zustand'
import logger from '@/logger'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {ackPushTap as nativeAckPushTap} from 'react-native-kb'

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
// A queued intent older than this is stale and is acknowledged without navigating.
export const navigationIntentLifetimeMs = 5 * 60_000

// A tapped notification stays held in react-native-kb until it is acked by id (see
// constants/init/shared's listenForPushTaps), so every pushTapID that leaves s.intent -- consumed,
// merged away, superseded by a different pending intent, or discarded outright -- must be acked
// here, or the next peek hands the same tap back. Ids already acked are remembered for the life of
// this JS runtime so a tap that is peeked again never navigates twice; module state, not store
// state, because it must survive resetState, which runs on every account switch.
const ackedPushTapIDs = new Set<number>()

const ackPushTap = (pushTapID: number | undefined) => {
  if (pushTapID === undefined || ackedPushTapIDs.has(pushTapID)) return
  ackedPushTapIDs.add(pushTapID)
  nativeAckPushTap(pushTapID)
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
          if (ackedPushTapIDs.has(pushTapID)) {
            // Native still holds a tap this store already acked, so that ack did not land.
            // Repeat it; the tap left the store once and must not navigate a second time.
            nativeAckPushTap(pushTapID)
            return
          }
        }

        if (
          pending?.url === url &&
          (!pending.targetUid || !targetUid || pending.targetUid === targetUid)
        ) {
          const targetUidChanged = !pending.targetUid && !!targetUid
          // pushTapID is guaranteed different from pending.pushTapID here (equal is caught
          // above), so a newer tap replaced the one this intent carries in native's single
          // slot -- adopt its id so the eventual ack retires the tap native still holds.
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

        // A tap for another account waits here while account-link-switch switches to it. A
        // plain link arriving during that switch is dropped rather than superseding the tap, as
        // the tap replayed after the switch used to replace it. Another tap still supersedes it,
        // and so does anything once the tap has outlived the router's intent lifetime.
        if (
          !targetUid &&
          pushTapID === undefined &&
          pending?.pushTapID !== undefined &&
          pending.targetUid &&
          pending.targetUid !== useCurrentUserState.getState().uid &&
          useConfigState.getState().userSwitching &&
          now - pending.createdAt <= navigationIntentLifetimeMs
        ) {
          logger.info('[PushTap] dropping a link while a tap waits for its account:', url)
          return
        }

        // A different pending intent is replaced outright rather than merged (see above), so
        // its own tap -- if it carries one, and whether or not native has already replaced it
        // with a newer one -- is given up on for good here.
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
