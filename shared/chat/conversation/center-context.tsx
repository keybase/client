import * as ConvoState from '@/stores/convostate'
import * as React from 'react'
import * as T from '@/constants/types'
import {clearThreadHighlightMessageID} from '@/constants/router'
import {useChatThreadRouteParams} from './thread-search-route'
import {useThreadLoadStatusReporter} from './thread-load-status-context'

type CenterState = {
  center: T.Chat.CenterOrdinal | undefined
  threadSearchVisible: boolean
}

type CenterContextType = {
  centerOnMessage: (
    messageID: T.Chat.MessageID,
    highlightMode: T.Chat.CenterOrdinalHighlightMode
  ) => void
  centeredHighlightOrdinal: T.Chat.Ordinal | undefined
  centeredOrdinal: T.Chat.Ordinal | undefined
  clearCenter: () => void
  hasCenter: boolean
  jumpToRecent: () => void
}

const missingContext = () => {
  throw new Error('Missing ConversationCenterContext in the tree')
}

const CenterContext = React.createContext<CenterContextType>({
  centerOnMessage: missingContext,
  centeredHighlightOrdinal: undefined,
  centeredOrdinal: undefined,
  clearCenter: missingContext,
  hasCenter: false,
  jumpToRecent: missingContext,
})

export const useConversationCenter = () => React.useContext(CenterContext)

const stateForThreadSearchVisible = (state: CenterState, threadSearchVisible: boolean): CenterState => {
  if (state.threadSearchVisible === threadSearchVisible) {
    return state
  }
  return {
    center: threadSearchVisible
      ? state.center
        ? {...state.center, highlightMode: 'none'}
        : undefined
      : undefined,
    threadSearchVisible,
  }
}

export const ConversationCenterProvider = function ConversationCenterProvider(p: {
  children: React.ReactNode
  id: T.Chat.ConversationIDKey
}) {
  const {children, id} = p
  const routeParams = useChatThreadRouteParams()
  const threadSearchVisible = !!routeParams?.threadSearch
  const routeHighlightMessageID = routeParams?.highlightMessageID
  const onThreadLoadStatus = useThreadLoadStatusReporter()
  const [centerState, setCenterState] = React.useState<CenterState>(() => ({
    center: undefined,
    threadSearchVisible,
  }))

  const currentCenterState = stateForThreadSearchVisible(centerState, threadSearchVisible)

  const setCenterForMessage = (
    messageID: T.Chat.MessageID,
    highlightMode: T.Chat.CenterOrdinalHighlightMode
  ) => {
    const ordinal = T.Chat.numberToOrdinal(T.Chat.messageIDToNumber(messageID))
    setCenterState(state => ({
      ...stateForThreadSearchVisible(state, threadSearchVisible),
      center: {highlightMode, ordinal},
    }))
  }

  const clearCenter = () => {
    setCenterState(state => {
      const current = stateForThreadSearchVisible(state, threadSearchVisible)
      return current.center ? {...current, center: undefined} : current
    })
  }

  const centerOnMessage = (
    messageID: T.Chat.MessageID,
    highlightMode: T.Chat.CenterOrdinalHighlightMode
  ) => {
    setCenterForMessage(messageID, highlightMode)
    ConvoState.getConvoState(id).dispatch.loadMessagesCentered(messageID, highlightMode, {
      onThreadLoadStatus,
    })
  }

  const jumpToRecent = () => {
    clearCenter()
    ConvoState.getConvoState(id).dispatch.jumpToRecent({onThreadLoadStatus})
  }

  const consumedRouteHighlightRef = React.useRef<T.Chat.MessageID | undefined>(undefined)
  const consumeRouteHighlight = React.useEffectEvent((messageID: T.Chat.MessageID) => {
    centerOnMessage(messageID, 'flash')
    clearThreadHighlightMessageID()
  })
  React.useEffect(() => {
    if (!routeHighlightMessageID) {
      consumedRouteHighlightRef.current = undefined
      return
    }
    if (consumedRouteHighlightRef.current === routeHighlightMessageID) {
      return
    }
    consumedRouteHighlightRef.current = routeHighlightMessageID
    consumeRouteHighlight(routeHighlightMessageID)
  }, [routeHighlightMessageID])

  const center = currentCenterState.center
  const centeredHighlightOrdinal = center && center.highlightMode !== 'none' ? center.ordinal : undefined
  const value = {
    centerOnMessage,
    centeredHighlightOrdinal,
    centeredOrdinal: center?.ordinal,
    clearCenter,
    hasCenter: !!center,
    jumpToRecent,
  }

  return <CenterContext value={value}>{children}</CenterContext>
}
