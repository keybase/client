import * as Chat from '@/stores/chat'
import * as T from '@/constants/types'
import * as Hooks from './hooks'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import Separator from '../messages/separator'
import SpecialBottomMessage from '../messages/special-bottom-message'
import SpecialTopMessage from '../messages/special-top-message'
import type {ItemType} from '.'
import {LegendList, type LegendListRef} from '@legendapp/list/react-native'
import {getMessageRender} from '../messages/wrapper'
import {mobileTypingContainerHeight} from '../input-area/normal/typing'
import {SetRecycleTypeContext} from '../recycle-type-context'
// import {useChatDebugDump} from '@/constants/chat/debug'
import {PerfProfiler} from '@/perf/react-profiler'
import {ScrollContext} from '../normal/context'
import noop from 'lodash/noop'
// import {useDebugLayout} from '@/util/debug-react'

// We load the first thread automatically so in order to mark it read
// we send an action on the first mount once
let markedInitiallyLoaded = false

export const DEBUGDump = () => {}

const useScrolling = (p: {
  centeredOrdinal: T.Chat.Ordinal
  messageOrdinals: Array<T.Chat.Ordinal>
  conversationIDKey: T.Chat.ConversationIDKey
  listRef: React.RefObject<LegendListRef | null>
}) => {
  const {listRef, centeredOrdinal, messageOrdinals} = p
  const numOrdinals = messageOrdinals.length
  const loadOlderMessages = Chat.useChatContext(s => s.dispatch.loadOlderMessagesDueToScroll)
  const [scrollToBottom] = React.useState(() => () => {
    void listRef.current?.scrollToEnd({animated: false})
  })

  const {setScrollRef} = React.useContext(ScrollContext)
  React.useEffect(() => {
    setScrollRef({scrollDown: noop, scrollToBottom, scrollUp: noop})
  }, [setScrollRef, scrollToBottom])

  // only scroll to center once per
  const lastScrollToCentered = React.useRef(-1)
  React.useEffect(() => {
    if (T.Chat.ordinalToNumber(centeredOrdinal) < 0) {
      lastScrollToCentered.current = -1
    }
  }, [centeredOrdinal])

  const centeredOrdinalRef = React.useRef(centeredOrdinal)
  React.useEffect(() => {
    centeredOrdinalRef.current = centeredOrdinal
  }, [centeredOrdinal])
  const [scrollToCentered] = React.useState(() => () => {
    setTimeout(() => {
      const list = listRef.current
      if (!list) {
        return
      }
      const co = centeredOrdinalRef.current
      if (lastScrollToCentered.current === co) {
        return
      }

      lastScrollToCentered.current = co
      void list.scrollToItem({animated: false, item: co, viewPosition: 0.5})
    }, 100)
  })

  const onStartReached = () => {
    loadOlderMessages(numOrdinals)
  }

  return {
    onStartReached,
    scrollToBottom,
    scrollToCentered,
  }
}

const ConversationList = function ConversationList() {
  const debugWhichList = __DEV__ ? (
    <Kb.Text type="HeaderBig" style={{backgroundColor: 'red', left: 0, position: 'absolute', top: 0}}>
      legend
    </Kb.Text>
  ) : null

  const conversationIDKey = Chat.useChatContext(s => s.id)

  const loaded = Chat.useChatContext(s => s.loaded)
  const centeredOrdinal =
    Chat.useChatContext(s => s.messageCenterOrdinal)?.ordinal ?? T.Chat.numberToOrdinal(-1)
  const messageTypeMap = Chat.useChatContext(s => s.messageTypeMap)
  const _messageOrdinals = Chat.useChatContext(s => s.messageOrdinals)

  const messageOrdinals: Array<T.Chat.Ordinal> = _messageOrdinals ? [..._messageOrdinals] : []

  const listRef = React.useRef<LegendListRef | null>(null)
  const {markInitiallyLoadedThreadAsRead} = Hooks.useActions({conversationIDKey})
  const keyExtractor = (ordinal: ItemType) => {
    return String(ordinal)
  }

  const renderItem = ({item: ordinal}: {item: T.Chat.Ordinal}) => {
    const type = messageTypeMap.get(ordinal) ?? 'text'
    const Clazz = getMessageRender(type)
    if (!Clazz) return null
    return (
      <>
        <Separator leadingItem={ordinal} trailingItem={ordinal} />
        <PerfProfiler id={`Msg-${type}`}><Clazz ordinal={ordinal} /></PerfProfiler>
      </>
    )
  }

  const recycleTypeRef = React.useRef(new Map<T.Chat.Ordinal, string>())
  const setRecycleType = (ordinal: T.Chat.Ordinal, type: string) => {
    recycleTypeRef.current.set(ordinal, type)
  }

  const numOrdinals = messageOrdinals.length

  const getItemType = (ordinal: T.Chat.Ordinal, idx: number) => {
    if (!ordinal) {
      return 'null'
    }
    // Check recycleType first (set by messages after render — includes subtypes like 'text:reply')
    const recycled = recycleTypeRef.current.get(ordinal)
    if (recycled) return recycled
    const baseType = messageTypeMap.get(ordinal) ?? 'text'
    // Last item is most-recently sent; isolate it to avoid recycling with settled messages
    if (numOrdinals - 1 === idx && (baseType === 'text' || baseType === 'attachment')) {
      return `${baseType}:pending`
    }
    return baseType
  }

  const {scrollToCentered, scrollToBottom, onStartReached: onStartReachedBase} = useScrolling({
    centeredOrdinal,
    conversationIDKey,
    listRef,
    messageOrdinals,
  })

  const jumpToRecent = Hooks.useJumpToRecent(scrollToBottom, messageOrdinals.length)

  const lastCenteredOrdinal = React.useRef(0)
  React.useEffect(() => {
    if (lastCenteredOrdinal.current === centeredOrdinal) {
      return
    }
    lastCenteredOrdinal.current = centeredOrdinal
    if (centeredOrdinal > 0) {
      const id = setTimeout(() => {
        scrollToCentered()
      }, 200)
      return () => {
        clearTimeout(id)
      }
    }
    return undefined
  }, [centeredOrdinal, scrollToCentered])

  React.useEffect(() => {
    if (!markedInitiallyLoaded) {
      markedInitiallyLoaded = true
      markInitiallyLoadedThreadAsRead()
    }
  }, [markInitiallyLoadedThreadAsRead])

  const prevLoadedRef = React.useRef(loaded)
  React.useLayoutEffect(() => {
    const justLoaded = loaded && !prevLoadedRef.current
    prevLoadedRef.current = loaded

    if (!justLoaded) return

    if (centeredOrdinal > 0) {
      scrollToCentered()
      setTimeout(() => {
        scrollToCentered()
      }, 100)
    } else if (numOrdinals > 0) {
      scrollToBottom()
      setTimeout(() => {
        scrollToBottom()
      }, 100)
    }
  }, [loaded, centeredOrdinal, scrollToBottom, scrollToCentered, numOrdinals])

  // useChatDebugDump(
  //   'listArea',
  //   C.useEvent(() => {
  //     if (!listRef.current) return ''
  //     const {props, state} = listRef.current as {
  //       props: {extraData?: {}; data?: [number]}
  //       state?: object
  //     }
  //     const {extraData, data} = props
  //
  //     // const layoutManager = (state?.layoutProvider?._lastLayoutManager ?? ({} as unknown)) as {
  //     //   _layouts?: [unknown]
  //     //   _renderWindowSize: unknown
  //     //   _totalHeight: unknown
  //     //   _totalWidth: unknown
  //     // }
  //     // const {_layouts, _renderWindowSize, _totalHeight, _totalWidth} = layoutManager
  //     // const mm = window.DEBUGStore.store.getState().chat.messageMap.get(conversationIDKey)
  //     // const stateItems = messageOrdinals.map(o => ({o, type: mm.get(o)?.type}))
  //
  //     console.log(listRef.current)
  //
  //     const items = data?.map((ordinal: number, idx: number) => {
  //       const layout = _layouts?.[idx]
  //       // const m = mm.get(ordinal) ?? ({} as any)
  //       return {
  //         idx,
  //         layout,
  //         ordinal,
  //         // rid: m.id,
  //         // rtype: m.type,
  //       }
  //     })
  //
  //     const details = {
  //       // children,
  //       _renderWindowSize,
  //       _totalHeight,
  //       _totalWidth,
  //       data,
  //       extraData,
  //       items,
  //     }
  //     return JSON.stringify(details)
  //   })
  // )

  const lastStartReachedRef = React.useRef(0)
  const onStartReached = () => {
    const t = Date.now()
    if (t - lastStartReachedRef.current < 1000) return
    lastStartReachedRef.current = t
    onStartReachedBase()
  }
  // const onLayout = useDebugLayout()

  return (
    <Kb.ErrorBoundary>
      <SetRecycleTypeContext value={setRecycleType}>
          <PerfProfiler id="MessageList">
          <Kb.Box2 direction="vertical" fullWidth={true} flex={1} relative={true}>
            <LegendList
              testID="messageList"
              extraData={messageTypeMap}
              estimatedItemSize={44}
              ListHeaderComponent={SpecialTopMessage}
              ListFooterComponent={SpecialBottomMessage}
              overScrollMode="never"
              contentContainerStyle={styles.contentContainer}
              data={messageOrdinals}
              getItemType={getItemType}
              renderItem={renderItem}
              onStartReached={onStartReached}
              onStartReachedThreshold={0.3}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              keyExtractor={keyExtractor}
              ref={listRef}
              recycleItems={true}
              alignItemsAtEnd={true}
              initialScrollAtEnd={true}
              maintainScrollAtEnd={{animated: false}}
              maintainVisibleContentPosition={{data: true}}
            />
            {jumpToRecent}
            {debugWhichList}
          </Kb.Box2>
          </PerfProfiler>
      </SetRecycleTypeContext>
    </Kb.ErrorBoundary>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      contentContainer: {
        paddingBottom: mobileTypingContainerHeight,
        paddingTop: 0,
      },
    }) as const
)

export default ConversationList
