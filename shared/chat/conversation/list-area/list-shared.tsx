import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import * as React from 'react'
import * as T from '@/constants/types'
import {chatDebugEnabled} from '@/constants/chat/debug'
import logger from '@/logger'
import {PerfProfiler} from '@/perf/react-profiler'
import {getMessageRender} from '../messages/wrapper'
import type {ItemType} from '.'

export const emptyOrdinals: Array<T.Chat.Ordinal> = []

export const hasOrdinal = (ordinal: T.Chat.Ordinal) => T.Chat.ordinalToNumber(ordinal) > 0
export const keyExtractor = (ordinal: ItemType) => String(ordinal)

type ScrollableListRef = {
  scrollToIndex: (params: {animated?: boolean; index: number; viewPosition?: number}) => Promise<void> | void
}

export const useConversationListData = () =>
  Chat.useChatContext(
    C.useShallow(s => {
      const {editing: editingOrdinal, id: conversationIDKey, messageTypeMap, ordinalIndexMap} = s
      const {messageCenterOrdinal: mco, messageOrdinals = emptyOrdinals, loaded} = s
      const centeredHighlightOrdinal =
        mco?.highlightMode !== 'none' ? (mco.ordinal ?? T.Chat.numberToOrdinal(-1)) : T.Chat.numberToOrdinal(-1)
      const centeredOrdinal = mco?.ordinal ?? T.Chat.numberToOrdinal(-1)
      const containsLatestMessage = s.isCaughtUp()
      return {
        centeredHighlightOrdinal,
        centeredOrdinal,
        containsLatestMessage,
        conversationIDKey,
        editingOrdinal,
        loaded,
        messageOrdinals,
        messageTypeMap,
        ordinalIndexMap,
      }
    })
  )

export const useTopOnScreen = (messageOrdinals: ReadonlyArray<T.Chat.Ordinal>) => {
  const firstOrdinal = messageOrdinals[0]
  const [isTopOnScreen, setIsTopOnScreen] = React.useState(false)
  const onViewableItemsChanged = React.useCallback(
    ({viewableItems}: {viewableItems: ReadonlyArray<{item: T.Chat.Ordinal}>}) => {
      setIsTopOnScreen(viewableItems[0]?.item === firstOrdinal)
    },
    [firstOrdinal]
  )
  return {isTopOnScreen, onViewableItemsChanged}
}

export const useScrollToCentered = (
  listRef: React.RefObject<ScrollableListRef | null>,
  centeredOrdinal: T.Chat.Ordinal,
  ordinalIndexMap: ReadonlyMap<T.Chat.Ordinal, number>
) => {
  const lastScrollToCentered = React.useRef(-1)
  React.useEffect(() => {
    if (!hasOrdinal(centeredOrdinal)) {
      lastScrollToCentered.current = -1
    }
  }, [centeredOrdinal])

  const centeredOrdinalRef = React.useRef(centeredOrdinal)
  React.useEffect(() => {
    centeredOrdinalRef.current = centeredOrdinal
  }, [centeredOrdinal])

  const ordinalIndexMapRef = React.useRef(ordinalIndexMap)
  React.useEffect(() => {
    ordinalIndexMapRef.current = ordinalIndexMap
  }, [ordinalIndexMap])

  const [scrollToCentered] = React.useState(() => () => {
    const list = listRef.current
    if (!list) {
      return
    }
    const ordinal = centeredOrdinalRef.current
    if (!hasOrdinal(ordinal) || lastScrollToCentered.current === ordinal) {
      return
    }
    lastScrollToCentered.current = ordinal

    const idx = ordinalIndexMapRef.current.get(ordinal) ?? -1
    if (idx < 0) {
      return
    }

    void Promise.resolve(list.scrollToIndex({animated: false, index: idx, viewPosition: 0.5})).then(() => {
      void list.scrollToIndex({animated: false, index: idx, viewPosition: 0.5})
    })
  })

  return scrollToCentered
}

export const useOnStartReached = (p: {
  isTopOnScreen: boolean
  numOrdinals: number
  onStartReachedBase: () => void
}) => {
  const {isTopOnScreen, numOrdinals, onStartReachedBase} = p
  const isLoadingOlderRef = React.useRef(false)
  const prevNumOrdinalsRef = React.useRef(numOrdinals)
  const loadResetTimerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const onStartReachedBaseRef = React.useRef(onStartReachedBase)

  React.useEffect(() => {
    onStartReachedBaseRef.current = onStartReachedBase
  }, [onStartReachedBase])

  React.useEffect(() => {
    if (numOrdinals !== prevNumOrdinalsRef.current) {
      prevNumOrdinalsRef.current = numOrdinals
      isLoadingOlderRef.current = false
      clearTimeout(loadResetTimerRef.current)
    }
  }, [numOrdinals])

  React.useEffect(() => () => clearTimeout(loadResetTimerRef.current), [])

  const [onStartReached] = React.useState(() => () => {
    if (isLoadingOlderRef.current) return
    isLoadingOlderRef.current = true
    clearTimeout(loadResetTimerRef.current)
    loadResetTimerRef.current = setTimeout(() => {
      isLoadingOlderRef.current = false
    }, 3000)
    onStartReachedBaseRef.current()
  })

  React.useEffect(() => {
    if (isTopOnScreen) {
      onStartReached()
    }
  }, [isTopOnScreen, onStartReached])

  return onStartReached
}

export const useRecycleType = (
  messageOrdinals: ReadonlyArray<T.Chat.Ordinal>,
  messageTypeMap: ReadonlyMap<T.Chat.Ordinal, T.Chat.RenderMessageType>
) => {
  const recycleTypeRef = React.useRef(new Map<T.Chat.Ordinal, string>())
  const [setRecycleType] = React.useState(() => (ordinal: T.Chat.Ordinal, type: string) => {
    recycleTypeRef.current.set(ordinal, type)
  })

  const numOrdinals = messageOrdinals.length
  const getItemType = React.useCallback(
    (ordinal: T.Chat.Ordinal, idx: number) => {
      if (!ordinal) {
        return 'null'
      }
      const recycled = recycleTypeRef.current.get(ordinal)
      if (recycled) return recycled
      const baseType = messageTypeMap.get(ordinal) ?? 'text'
      if (numOrdinals - 1 === idx && (baseType === 'text' || baseType === 'attachment')) {
        return `${baseType}:pending`
      }
      return baseType
    },
    [messageTypeMap, numOrdinals]
  )

  return {getItemType, setRecycleType}
}

export const useMessageNodeRenderer = (p: {
  centeredHighlightOrdinal: T.Chat.Ordinal
  lastOrdinal: T.Chat.Ordinal | undefined
  messageTypeMap: ReadonlyMap<T.Chat.Ordinal, T.Chat.RenderMessageType>
}) => {
  const {centeredHighlightOrdinal, lastOrdinal, messageTypeMap} = p
  return React.useCallback(
    (ordinal: T.Chat.Ordinal) => {
      const type = messageTypeMap.get(ordinal) ?? 'text'
      const Clazz = getMessageRender(type)
      if (!Clazz) {
        if (chatDebugEnabled) {
          logger.error('[CHATDEBUG] no rendertype', {ordinal, type})
        }
        return null
      }
      return {
        node: (
          <PerfProfiler id={`Msg-${type}`}>
            <Clazz
              isCenteredHighlight={centeredHighlightOrdinal === ordinal}
              isLastMessage={lastOrdinal === ordinal}
              ordinal={ordinal}
            />
          </PerfProfiler>
        ),
        type,
      }
    },
    [centeredHighlightOrdinal, lastOrdinal, messageTypeMap]
  )
}
