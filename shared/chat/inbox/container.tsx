import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import * as React from 'react'
import type * as T from '@/constants/types'
import Inbox from '.'
import {useIsFocused} from '@react-navigation/core'

type OwnProps = {
  navKey: string
  conversationIDKey?: T.Chat.ConversationIDKey
}

const emptyMap = new Map()

const Connected = (ownProps: OwnProps) => {
  const {navKey, conversationIDKey} = ownProps
  const isFocused = useIsFocused()

  const chatState = Chat.useChatState(
    C.useShallow(s => ({
      allowShowFloatingButton: s.inboxAllowShowFloatingButton,
      inboxHasLoaded: s.inboxHasLoaded,
      inboxNumSmallRows: s.inboxNumSmallRows ?? 5,
      inboxRefresh: s.dispatch.inboxRefresh,
      inboxRows: s.inboxRows,
      isSearching: !!s.inboxSearch,
      queueMetaToRequest: s.dispatch.queueMetaToRequest,
      setInboxNumSmallRows: s.dispatch.setInboxNumSmallRows,
      smallTeamsExpanded: s.inboxSmallTeamsExpanded,
      toggleSmallTeamsExpanded: s.dispatch.toggleSmallTeamsExpanded,
    }))
  )
  const {
    allowShowFloatingButton, inboxHasLoaded, inboxNumSmallRows,
    inboxRefresh, inboxRows, isSearching, queueMetaToRequest, setInboxNumSmallRows,
    smallTeamsExpanded, toggleSmallTeamsExpanded,
  } = chatState

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

  // Compute unreadIndices from pre-computed rows (big teams with badges)
  const unreadIndices = new Map<number, number>()
  let unreadTotal = 0
  inboxRows.forEach((row, idx) => {
    if (row.type === 'big' && row.conversationIDKey !== selectedConversationIDKey && row.badge > 0) {
      unreadIndices.set(idx, row.badge)
      unreadTotal += row.badge
    }
  })

  return (
    <Inbox
      allowShowFloatingButton={allowShowFloatingButton}
      inboxNumSmallRows={inboxNumSmallRows}
      isSearching={isSearching}
      navKey={navKey}
      neverLoaded={!inboxHasLoaded}
      onNewChat={appendNewChatBuilder}
      onUntrustedInboxVisible={queueMetaToRequest}
      rows={inboxRows}
      selectedConversationIDKey={selectedConversationIDKey}
      setInboxNumSmallRows={setInboxNumSmallRows}
      smallTeamsExpanded={smallTeamsExpanded}
      toggleSmallTeamsExpanded={toggleSmallTeamsExpanded}
      unreadIndices={unreadIndices.size ? unreadIndices : emptyMap}
      unreadTotal={unreadTotal}
    />
  )
}

export default Connected
