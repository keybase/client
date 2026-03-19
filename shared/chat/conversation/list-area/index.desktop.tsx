import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import * as Kb from '@/common-adapters'
import * as Hooks from './hooks'
import * as React from 'react'
import * as T from '@/constants/types'
import type {LegendListRef} from '@/common-adapters'
import {LegendList} from '@legendapp/list/react'
import Separator from '../messages/separator'
import SpecialBottomMessage from '../messages/special-bottom-message'
import SpecialTopMessage from '../messages/special-top-message'
import {SetRecycleTypeContext} from '../recycle-type-context'
import {globalMargins} from '@/styles/shared'
import {FocusContext, ScrollContext} from '../normal/context'
import {useConfigState} from '@/stores/config'
import {PerfProfiler} from '@/perf/react-profiler'
import {
  hasOrdinal,
  keyExtractor,
  useConversationListData,
  useMessageNodeRenderer,
  useOnStartReached,
  useRecycleType,
  useScrollToCentered,
  useTopOnScreen,
} from './list-shared'

// We load the first thread automatically so in order to mark it read
// we send an action on the first mount once
let markedInitiallyLoaded = false

const LegendListAny: any = LegendList

const useScrolling = (p: {
  centeredOrdinal: T.Chat.Ordinal
  containsLatestMessage: boolean
  isTopOnScreen: boolean
  listRef: React.RefObject<LegendListRef | null>
  loaded: boolean
  markInitiallyLoadedThreadAsRead: () => void
  messageOrdinals: ReadonlyArray<T.Chat.Ordinal>
  ordinalIndexMap: ReadonlyMap<T.Chat.Ordinal, number>
}) => {
  const {centeredOrdinal, containsLatestMessage, isTopOnScreen, listRef, loaded, markInitiallyLoadedThreadAsRead} = p
  const {messageOrdinals, ordinalIndexMap} = p
  const numOrdinals = messageOrdinals.length
  const loadOlderMessagesDueToScroll = Chat.useChatContext(s => s.dispatch.loadOlderMessagesDueToScroll)
  const loadNewerMessagesDueToScroll = Chat.useChatContext(s => s.dispatch.loadNewerMessagesDueToScroll)
  const {setScrollRef} = React.useContext(ScrollContext)
  const numOrdinalsRef = React.useRef(numOrdinals)
  const loadOlderMessagesDueToScrollRef = React.useRef(loadOlderMessagesDueToScroll)
  const loadNewerMessagesDueToScrollRef = React.useRef(loadNewerMessagesDueToScroll)

  React.useEffect(() => {
    numOrdinalsRef.current = numOrdinals
    loadOlderMessagesDueToScrollRef.current = loadOlderMessagesDueToScroll
    loadNewerMessagesDueToScrollRef.current = loadNewerMessagesDueToScroll
  }, [loadNewerMessagesDueToScroll, loadOlderMessagesDueToScroll, numOrdinals])

  const containsLatestMessageRef = React.useRef(containsLatestMessage)
  React.useEffect(() => {
    containsLatestMessageRef.current = containsLatestMessage
  }, [containsLatestMessage])

  const centeredOrdinalRef = React.useRef(centeredOrdinal)
  React.useEffect(() => {
    centeredOrdinalRef.current = centeredOrdinal
  }, [centeredOrdinal])

  const topVisibleOrdinalRef = React.useRef<T.Chat.Ordinal | undefined>(undefined)
  const lockedToBottomRef = React.useRef(true)

  const [isLockedToBottom] = React.useState(() => () => lockedToBottomRef.current)
  const [didFirstLoad, setDidFirstLoad] = React.useState(false)

  const loadNewerMessagesThrottled = C.useThrottledCallback(() => {
    loadNewerMessagesDueToScrollRef.current(numOrdinalsRef.current)
  }, 200)

  React.useEffect(
    () => () => {
      loadNewerMessagesThrottled.cancel()
    },
    [loadNewerMessagesThrottled]
  )

  const [scrollToBottom] = React.useState(() => () => {
    lockedToBottomRef.current = true
    void listRef.current?.scrollToEnd({animated: false})
    setTimeout(() => {
      requestAnimationFrame(() => {
        void listRef.current?.scrollToEnd({animated: false})
      })
    }, 1)
  })

  const scrollToCentered = useScrollToCentered(listRef, centeredOrdinal, ordinalIndexMap)

  const [scrollDown] = React.useState(() => () => {
    const list = listRef.current
    if (!list) return
    const {end, start} = list.getState()
    const pageSize = Math.max(1, end - start)
    const nextIndex = Math.min(Math.max(0, numOrdinalsRef.current - 1), Math.max(end, start, 0) + pageSize)
    void list.scrollToIndex({animated: false, index: nextIndex, viewPosition: 0})
  })

  const [scrollUp] = React.useState(() => () => {
    lockedToBottomRef.current = false
    const list = listRef.current
    if (!list) return
    const {end, start} = list.getState()
    const pageSize = Math.max(1, end - start)
    const nextIndex = Math.max(0, Math.max(0, start) - pageSize)
    void list.scrollToIndex({animated: false, index: nextIndex, viewPosition: 0})
  })

  React.useEffect(() => {
    setScrollRef({scrollDown, scrollToBottom, scrollUp})
  }, [scrollDown, scrollToBottom, scrollUp, setScrollRef])

  React.useEffect(() => {
    if (loaded && !didFirstLoad) {
      requestAnimationFrame(() => {
        setDidFirstLoad(true)
      })
    }
  }, [loaded, didFirstLoad])

  const prevLoadedRef = React.useRef(loaded)
  React.useLayoutEffect(() => {
    const justLoaded = loaded && !prevLoadedRef.current
    prevLoadedRef.current = loaded
    if (!justLoaded) return

    if (!markedInitiallyLoaded) {
      markedInitiallyLoaded = true
      markInitiallyLoadedThreadAsRead()
    }

    if (hasOrdinal(centeredOrdinal)) {
      lockedToBottomRef.current = false
      scrollToCentered()
    } else {
      scrollToBottom()
    }
  }, [centeredOrdinal, loaded, markInitiallyLoadedThreadAsRead, scrollToBottom, scrollToCentered])

  const firstOrdinal = messageOrdinals[0]
  const prevFirstOrdinalRef = React.useRef(firstOrdinal)
  const prevNumOrdinalsRef = React.useRef(numOrdinals)
  React.useLayoutEffect(() => {
    if (!numOrdinals) {
      lockedToBottomRef.current = false
      return
    }

    const olderMessagesAdded = prevFirstOrdinalRef.current !== firstOrdinal
    prevFirstOrdinalRef.current = firstOrdinal

    if (numOrdinals === prevNumOrdinalsRef.current) {
      return
    }
    prevNumOrdinalsRef.current = numOrdinals

    if (
      olderMessagesAdded &&
      !hasOrdinal(centeredOrdinal) &&
      !isLockedToBottom() &&
      topVisibleOrdinalRef.current !== undefined
    ) {
      const idx = ordinalIndexMap.get(topVisibleOrdinalRef.current) ?? -1
      if (idx >= 0) {
        void listRef.current?.scrollToIndex({animated: false, index: idx, viewPosition: 0})
        return
      }
    }

    if (isLockedToBottom() && !hasOrdinal(centeredOrdinal)) {
      scrollToBottom()
    }
  }, [centeredOrdinal, firstOrdinal, isLockedToBottom, listRef, numOrdinals, ordinalIndexMap, scrollToBottom])

  const prevCenteredOrdinalRef = React.useRef(centeredOrdinal)
  const wasLoadedRef = React.useRef(loaded)
  React.useEffect(() => {
    const wasLoaded = wasLoadedRef.current
    const changed = prevCenteredOrdinalRef.current !== centeredOrdinal
    prevCenteredOrdinalRef.current = centeredOrdinal
    wasLoadedRef.current = loaded

    if (!wasLoaded || !loaded || !changed) return

    if (hasOrdinal(centeredOrdinal)) {
      lockedToBottomRef.current = false
      scrollToCentered()
    } else if (containsLatestMessage) {
      lockedToBottomRef.current = true
      scrollToBottom()
    }
  }, [centeredOrdinal, containsLatestMessage, loaded, scrollToBottom, scrollToCentered])

  const [onViewableItemsChanged] = React.useState(
    () =>
      ({viewableItems}: {viewableItems: ReadonlyArray<{index?: number; item: T.Chat.Ordinal}>}) => {
        const end = viewableItems.at(-1)?.index ?? -1
        topVisibleOrdinalRef.current = viewableItems[0]?.item

        if (!hasOrdinal(centeredOrdinalRef.current) && containsLatestMessageRef.current) {
          lockedToBottomRef.current = end >= numOrdinalsRef.current - 1
        }

        if (
          !containsLatestMessageRef.current &&
          !lockedToBottomRef.current &&
          end >= numOrdinalsRef.current - 1
        ) {
          loadNewerMessagesThrottled()
        }
      }
  )

  const onStartReached = useOnStartReached({
    isTopOnScreen,
    numOrdinals,
    onStartReachedBase: () => {
      loadOlderMessagesDueToScrollRef.current(numOrdinalsRef.current)
    },
  })

  return {didFirstLoad, onStartReached, onViewableItemsChanged, scrollToBottom}
}

const ConversationList = function ConversationList() {
  const data = useConversationListData()
  const {
    centeredHighlightOrdinal,
    centeredOrdinal,
    containsLatestMessage,
    conversationIDKey,
    editingOrdinal,
    loaded,
    messageOrdinals,
    messageTypeMap,
    ordinalIndexMap,
  } = data

  const copyToClipboard = useConfigState(s => s.dispatch.defer.copyToClipboard)
  const listRef = React.useRef<LegendListRef | null>(null)
  const {markInitiallyLoadedThreadAsRead} = Hooks.useActions({conversationIDKey})
  const lastOrdinal = messageOrdinals.at(-1)
  const {isTopOnScreen, onViewableItemsChanged: onTopViewableItemsChanged} = useTopOnScreen(messageOrdinals)
  const renderMessageNode = useMessageNodeRenderer({centeredHighlightOrdinal, lastOrdinal, messageTypeMap})

  const {getItemType, setRecycleType} = useRecycleType(messageOrdinals, messageTypeMap)

  const renderItem = React.useCallback(
    ({item: ordinal}: {item: T.Chat.Ordinal}) => {
      const rendered = renderMessageNode(ordinal)
      if (!rendered) return null

      return (
        <div
          key={String(ordinal)}
          data-debug={String(ordinal)}
          className={Kb.Styles.classNames(
            'hover-container',
            'WrapperMessage',
            'WrapperMessage-hoverBox',
            'WrapperMessage-decorated',
            'WrapperMessage-hoverColor',
            {
              highlighted: centeredHighlightOrdinal === ordinal || editingOrdinal === ordinal,
            }
          )}
        >
          <Separator trailingItem={ordinal} />
          {rendered.node}
        </div>
      )
    },
    [centeredHighlightOrdinal, editingOrdinal, renderMessageNode]
  )

  const {
    didFirstLoad,
    onStartReached,
    onViewableItemsChanged: onScrollViewableItemsChanged,
    scrollToBottom,
  } = useScrolling({
      centeredOrdinal,
      containsLatestMessage,
      isTopOnScreen,
      listRef,
      loaded,
      markInitiallyLoadedThreadAsRead,
      messageOrdinals,
      ordinalIndexMap,
    })

  const onViewableItemsChanged = React.useCallback(
    (data: {viewableItems: ReadonlyArray<{index?: number; item: T.Chat.Ordinal}>}) => {
      onTopViewableItemsChanged(data)
      onScrollViewableItemsChanged(data)
    },
    [onScrollViewableItemsChanged, onTopViewableItemsChanged]
  )

  const jumpToRecent = Hooks.useJumpToRecent(scrollToBottom, messageOrdinals.length)

  const lastEditingOrdinalRef = React.useRef(editingOrdinal)
  React.useEffect(() => {
    if (lastEditingOrdinalRef.current === editingOrdinal) return
    lastEditingOrdinalRef.current = editingOrdinal
    if (!editingOrdinal) return
    const idx = ordinalIndexMap.get(editingOrdinal) ?? -1
    if (idx < 0) return
    void listRef.current?.scrollToIndex({animated: false, index: idx, viewPosition: 0.5})
  }, [editingOrdinal, ordinalIndexMap])

  const onCopyCapture = (e: React.BaseSyntheticEvent) => {
    // Copy text only, not HTML/styling. We use virtualText on texts to make uncopyable text
    e.preventDefault()
    const sel = window.getSelection()
    if (!sel) return
    const temp = sel.getRangeAt(0).cloneContents()
    // cloning it and making a new new fixes issues where icons will give you
    // extra newlines only when you do toString() vs getting the textContents
    const tempDiv = document.createElement('div')
    tempDiv.appendChild(temp)
    const styles = tempDiv.querySelectorAll('style')
    styles.forEach(s => {
      s.parentNode?.removeChild(s)
    })
    const imgs = tempDiv.querySelectorAll('img')
    imgs.forEach(i => {
      const dummy = document.createElement('div')
      dummy.textContent = '\n[IMAGE]\n'
      i.parentNode?.replaceChild(dummy, i)
    })

    const tc = tempDiv.textContent
    if (tc) {
      copyToClipboard(tc)
    }
    tempDiv.remove()
  }

  const {focusInput} = React.useContext(FocusContext)
  const handleListClick = (ev: React.MouseEvent) => {
    const target = ev.target
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      (target as HTMLElement).closest('[data-search-filter="true"]')
    ) {
      return
    }

    const sel = window.getSelection()
    if (sel?.isCollapsed) {
      focusInput()
    }
  }

  return (
    <Kb.ErrorBoundary>
      <div
        style={Kb.Styles.castStyleDesktop(styles.container)}
        onClick={handleListClick}
        onCopyCapture={onCopyCapture}
      >
        <SetRecycleTypeContext value={setRecycleType}>
          <PerfProfiler id="MessageList">
            <LegendListAny
              data={messageOrdinals}
              extraData={{centeredHighlightOrdinal, editingOrdinal, lastOrdinal, messageTypeMap}}
              estimatedItemSize={80}
              ListFooterComponent={SpecialBottomMessage}
              ListHeaderComponent={<SpecialTopMessage isOnScreen={isTopOnScreen} />}
              alignItemsAtEnd={true}
              className="chat-scroller"
              data-testid="message-list"
              drawDistance={400}
              getItemType={getItemType}
              initialScrollAtEnd={true}
              key={conversationIDKey}
              keyExtractor={keyExtractor}
              maintainScrollAtEnd={{animated: false}}
              maintainVisibleContentPosition={{data: true, size: true}}
              onStartReached={onStartReached}
              onStartReachedThreshold={0.3}
              onViewableItemsChanged={onViewableItemsChanged}
              recycleItems={true}
              ref={listRef}
              renderItem={renderItem}
              style={Kb.Styles.castStyleDesktop(
                Kb.Styles.collapseStyles([styles.list, {opacity: didFirstLoad ? 1 : 0}])
              )}
              testID="message-list"
              waitForInitialLayout={true}
            />
            {jumpToRecent}
          </PerfProfiler>
        </SetRecycleTypeContext>
      </div>
    </Kb.ErrorBoundary>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.globalStyles.flexBoxColumn,
          contain: 'layout style',
          flex: 1,
          position: 'relative',
        },
      }),
      list: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.globalStyles.fillAbsolute,
          outline: 'none',
          overscrollBehavior: 'contain',
          paddingBottom: globalMargins.small,
          willChange: 'transform',
        },
      }),
    }) as const
)

const ThreadWrapperWithProfiler = () => (
  <PerfProfiler id="MessageList">
    <ThreadWrapper />
  </PerfProfiler>
)

export default ThreadWrapperWithProfiler
