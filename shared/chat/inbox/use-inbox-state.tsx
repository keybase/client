import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import * as React from 'react'
import {useIsFocused} from '@react-navigation/core'

export function useInboxState(conversationIDKey?: string) {
  const isFocused = useIsFocused()

  const chatState = Chat.useChatState(
    C.useShallow(s => ({
      allowShowFloatingButton: s.inboxAllowShowFloatingButton,
      inboxHasLoaded: s.inboxHasLoaded,
      inboxNumSmallRows: s.inboxNumSmallRows ?? 5,
      inboxRefresh: s.dispatch.inboxRefresh,
      inboxRows: s.inboxRows,
      inboxUnreadBigIndices: s.inboxUnreadBigIndices,
      inboxUnreadBigTotal: s.inboxUnreadBigTotal,
      isSearching: !!s.inboxSearch,
      queueMetaToRequest: s.dispatch.queueMetaToRequest,
      setInboxNumSmallRows: s.dispatch.setInboxNumSmallRows,
      smallTeamsExpanded: s.inboxSmallTeamsExpanded,
      toggleSmallTeamsExpanded: s.dispatch.toggleSmallTeamsExpanded,
    }))
  )
  const {allowShowFloatingButton, inboxHasLoaded, inboxNumSmallRows, inboxRefresh, inboxRows} = chatState
  const {inboxUnreadBigIndices, inboxUnreadBigTotal} = chatState
  const {isSearching, queueMetaToRequest, setInboxNumSmallRows, smallTeamsExpanded, toggleSmallTeamsExpanded} = chatState

  const appendNewChatBuilder = C.useRouterState(s => s.appendNewChatBuilder)
  const selectedConversationIDKey = conversationIDKey ?? Chat.noConversationIDKey

  // Handle focus changes on mobile
  const prevIsFocusedRef = React.useRef(isFocused)
  React.useEffect(() => {
    if (prevIsFocusedRef.current === isFocused) return
    prevIsFocusedRef.current = isFocused
    if (C.isMobile && isFocused && Chat.isSplit) {
      Chat.getConvoState(Chat.getSelectedConversation()).dispatch.tabSelected()
    }
  }, [isFocused])

  C.useOnMountOnce(() => {
    if (!C.isMobile) {
      Chat.getConvoState(Chat.getSelectedConversation()).dispatch.tabSelected()
    }
    if (!inboxHasLoaded) {
      inboxRefresh('componentNeverLoaded')
    }
  })

  C.Router2.useSafeFocusEffect(() => {
    if (!inboxHasLoaded) {
      inboxRefresh('componentNeverLoaded')
    }
  })

  // Filter out the selected conversation from pre-computed store data.
  // When on the inbox screen, selectedConversationIDKey is usually noConversationIDKey
  // so the store-computed values are used directly.
  let unreadIndices = inboxUnreadBigIndices
  let unreadTotal = inboxUnreadBigTotal
  if (selectedConversationIDKey !== Chat.noConversationIDKey && inboxUnreadBigIndices.size) {
    // Rare path: viewing inbox with a selected conversation, filter it out
    const filtered = new Map<number, number>()
    let filteredTotal = 0
    inboxUnreadBigIndices.forEach((badge, idx) => {
      const row = inboxRows[idx]
      if (row?.type === 'big' && row.conversationIDKey !== selectedConversationIDKey) {
        filtered.set(idx, badge)
        filteredTotal += badge
      }
    })
    unreadIndices = filtered
    unreadTotal = filteredTotal
  }

  return {
    allowShowFloatingButton,
    inboxNumSmallRows,
    isSearching,
    neverLoaded: !inboxHasLoaded,
    onNewChat: appendNewChatBuilder,
    onUntrustedInboxVisible: queueMetaToRequest,
    rows: inboxRows,
    selectedConversationIDKey,
    setInboxNumSmallRows,
    smallTeamsExpanded,
    toggleSmallTeamsExpanded,
    unreadIndices,
    unreadTotal,
  }
}
