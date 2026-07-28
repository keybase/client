import * as Z from '@/util/zustand'

export type NavigationIntentOptions = {
  targetUid?: string
}

type NavigationIntent = {
  createdAt: number
  id: number
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

const targetsCouldMatch = (first?: string, second?: string) =>
  !first || !second || first === second

// Once an unscoped URL has been handled, a later targeted URL carries new
// account-routing information and must not be discarded. The reverse ordering
// is safe: an unscoped event after a targeted one can be the duplicate source.
const handledTargetMatches = (handled?: string, incoming?: string) =>
  !incoming || handled === incoming

export const useNavigationIntentsState = Z.createZustand<Store>(
  'navigation-intents',
  (set, get) => {
    let nextIntentID = 0
    const dispatch: Store['dispatch'] = {
      acknowledge: id => {
        set(s => {
          const intent = s.intent
          if (intent?.id !== id) return
          s.lastHandledIntent = {
            handledAt: Date.now(),
            targetUid: intent.targetUid,
            url: intent.url,
          }
          s.intent = undefined
        })
      },
      enqueue: (url, options) => {
        const now = Date.now()
        const targetUid = options?.targetUid
        const {intent: pending, lastHandledIntent} = get()
        if (pending?.url === url && targetsCouldMatch(pending.targetUid, targetUid)) {
          if (!pending.targetUid && targetUid) {
            set(s => {
              if (s.intent?.id === pending.id) {
                s.intent.targetUid = targetUid
              }
            })
          }
          return
        }
        if (
          lastHandledIntent?.url === url &&
          now - lastHandledIntent.handledAt < duplicateWindowMs &&
          handledTargetMatches(lastHandledIntent.targetUid, targetUid)
        ) {
          return
        }
        const id = ++nextIntentID
        set(s => {
          s.intent = {
            createdAt: now,
            id,
            targetUid,
            url,
          }
        })
      },
      markInitialURLHandled: url => {
        set(s => {
          const pending = s.intent
          const matchingPending = pending?.url === url ? pending : undefined
          if (matchingPending) {
            s.intent = undefined
          }
          s.lastHandledIntent = {
            handledAt: Date.now(),
            targetUid: matchingPending?.targetUid,
            url,
          }
        })
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
