import * as React from 'react'
import * as T from '@/constants/types'
import {consumeInputIntent, useInputIntentState} from './input-intent-store'
import {produce} from 'immer'
import {useChatThreadRouteParams} from './thread-search-route'
import {useThreadLoadStatusOptionsGetter} from './thread-load-status-context'
import {
  useConversationThreadJumpToRecent,
  useConversationThreadLoadMessagesCentered,
  useConversationThreadSetMarkReadBlocked,
  useConversationThreadStore,
} from './thread-context'

type CenterState = {
  center: T.Chat.CenterOrdinal | undefined
  // Bumped when search asks for its centred hit again with the row loaded, which reloads nothing:
  // the lists centre it again on their own.
  recenterVersion: number
  threadSearchVisible: boolean
}

type CenterStateContextType = {
  centeredHighlightOrdinal: T.Chat.Ordinal | undefined
  centeredOrdinal: T.Chat.Ordinal | undefined
  hasCenter: boolean
}

type CenterActionsContextType = {
  centerOnMessage: (messageID: T.Chat.MessageID, highlightMode: T.Chat.CenterOrdinalHighlightMode) => void
  clearCenter: () => void
  jumpToRecent: () => void
}

const missingContext = () => {
  throw new Error('Missing ConversationCenterContext in the tree')
}

// Split contexts: the state changes when centering/highlighting, the actions stay
// stable. Per-row consumers that only dispatch (e.g. reply-quote click) subscribe
// to actions only, so a highlight change doesn't re-render every row.
const CenterStateContext = React.createContext<CenterStateContextType>({
  centeredHighlightOrdinal: undefined,
  centeredOrdinal: undefined,
  hasCenter: false,
})
CenterStateContext.displayName = 'ConversationCenterStateContext'

// Its own context: only the lists' scroll hooks read it, and a re-centre must not re-render every row.
const RecenterVersionContext = React.createContext(0)
RecenterVersionContext.displayName = 'ConversationRecenterVersionContext'

const CenterActionsContext = React.createContext<CenterActionsContextType>({
  centerOnMessage: missingContext,
  clearCenter: missingContext,
  jumpToRecent: missingContext,
})
CenterActionsContext.displayName = 'ConversationCenterActionsContext'

export const useConversationCenter = () => React.useContext(CenterStateContext)
export const useConversationCenterActions = () => React.useContext(CenterActionsContext)
export const useConversationRecenterVersion = () => React.useContext(RecenterVersionContext)

// The other half of the input-intent bus's type split: the input provider claims the other four
// types (input-area/input-state.tsx). Neither may claim the other's or whichever mounts first
// silently eats it.
const centerInputIntentTypes = ['highlight'] as const

const stateForThreadSearchVisible = (state: CenterState, threadSearchVisible: boolean): CenterState =>
  produce(state, draft => {
    if (draft.threadSearchVisible === threadSearchVisible) {
      return
    }
    draft.threadSearchVisible = threadSearchVisible
    if (threadSearchVisible && draft.center) {
      draft.center.highlightMode = 'none'
    } else {
      draft.center = undefined
    }
  })

export const ConversationCenterProvider = function ConversationCenterProvider(p: {
  children: React.ReactNode
  id: T.Chat.ConversationIDKey
}) {
  const {children, id} = p
  const routeParams = useChatThreadRouteParams()
  const threadSearchVisible = !!routeParams?.threadSearch
  const getThreadLoadStatusOptions = useThreadLoadStatusOptionsGetter()
  const loadMessagesCentered = useConversationThreadLoadMessagesCentered()
  const jumpToRecentThread = useConversationThreadJumpToRecent()
  const setMarkReadBlocked = useConversationThreadSetMarkReadBlocked()
  const threadStore = useConversationThreadStore()
  const [centerState, setCenterState] = React.useState<CenterState>(() => ({
    center: undefined,
    recenterVersion: 0,
    threadSearchVisible,
  }))

  // Stored, not only derived: a search opened again must not bring back the hit a close dropped.
  // Every close only changes the route, so this is where closing drops the centre.
  const currentCenterState = stateForThreadSearchVisible(centerState, threadSearchVisible)
  if (currentCenterState !== centerState) {
    setCenterState(currentCenterState)
  }
  // Read when a centre is asked for: callers may hold a centerOnMessage from an earlier render (search
  // keeps the one it first got).
  const centerRef = React.useRef(currentCenterState.center)
  React.useLayoutEffect(() => {
    centerRef.current = currentCenterState.center
  }, [currentCenterState.center])

  const clearCenter = () => {
    setCenterState(state =>
      produce(stateForThreadSearchVisible(state, threadSearchVisible), draft => {
        draft.center = undefined
      })
    )
  }

  const centerOnMessage = (messageID: T.Chat.MessageID, highlightMode: T.Chat.CenterOrdinalHighlightMode) => {
    const ordinal = T.Chat.numberToOrdinal(T.Chat.messageIDToNumber(messageID))
    // Search ('always') asking for its centred hit again with the row loaded (it selects its first hit
    // itself, and the reader then clicks it): a reload would clear the thread and rebuild every row,
    // replaying the highlight. The lists centre it again on their own. Other jumps (a reply quote, the
    // pinned message) still reload, so the message flashes again.
    const recenter =
      highlightMode === 'always' &&
      centerRef.current?.ordinal === ordinal &&
      !!threadStore.getState().messageOrdinals?.includes(ordinal)
    setCenterState(state =>
      produce(stateForThreadSearchVisible(state, threadSearchVisible), draft => {
        draft.center = {highlightMode, ordinal}
        if (recenter) draft.recenterVersion++
      })
    )
    if (!recenter) loadMessagesCentered(messageID, highlightMode, getThreadLoadStatusOptions())
  }

  const jumpToRecent = () => {
    clearCenter()
    jumpToRecentThread(getThreadLoadStatusOptions())
  }

  React.useEffect(() => {
    setMarkReadBlocked(threadSearchVisible)
    return () => {
      setMarkReadBlocked(false)
    }
  }, [setMarkReadBlocked, threadSearchVisible])

  const applyHighlight = React.useEffectEvent((messageID: T.Chat.MessageID) => {
    setMarkReadBlocked(true)
    centerOnMessage(messageID, 'flash')
  })
  // Same two delivery moments as ConversationInputProvider: consume whatever was written before
  // we mounted, then a registered subscription for later writes. Not a selector hook - that would
  // re-render this subtree, and enableFreeze defers render-driven subscriptions on mobile while a
  // registered callback still runs. Delete-on-consume is the dedupe, so jumping twice to the same
  // messageID centers twice.
  React.useEffect(() => {
    const consume = () => {
      const intent = consumeInputIntent(id, centerInputIntentTypes)
      if (intent) {
        applyHighlight(intent.messageID)
      }
    }
    consume()
    return useInputIntentState.subscribe(consume)
  }, [id])

  const center = currentCenterState.center
  const centeredHighlightOrdinal = center && center.highlightMode !== 'none' ? center.ordinal : undefined
  const stateValue = {
    centeredHighlightOrdinal,
    centeredOrdinal: center?.ordinal,
    hasCenter: !!center,
  }
  const actionsValue = {
    centerOnMessage,
    clearCenter,
    jumpToRecent,
  }

  return (
    <CenterActionsContext value={actionsValue}>
      <CenterStateContext value={stateValue}>
        <RecenterVersionContext value={currentCenterState.recenterVersion}>{children}</RecenterVersionContext>
      </CenterStateContext>
    </CenterActionsContext>
  )
}
