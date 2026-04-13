import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import * as React from 'react'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {useIsFocused} from '@react-navigation/core'
import {buildInboxRows} from './rows'

export function useInboxState(conversationIDKey?: string, isSearching = false) {
  const isFocused = useIsFocused()
  const loggedIn = useConfigState(s => s.loggedIn)
  const username = useCurrentUserState(s => s.username)

  const chatState = Chat.useChatState(
    C.useShallow(s => ({
      inboxHasLoaded: s.inboxHasLoaded,
      inboxLayout: s.inboxLayout,
      inboxNumSmallRows: s.inboxNumSmallRows ?? 5,
      inboxRefresh: s.dispatch.inboxRefresh,
      queueMetaToRequest: s.dispatch.queueMetaToRequest,
      setInboxNumSmallRows: s.dispatch.setInboxNumSmallRows,
      smallTeamBadgeCount: s.smallTeamBadgeCount,
      smallTeamsExpanded: s.smallTeamsExpanded,
      toggleSmallTeamsExpanded: s.dispatch.toggleSmallTeamsExpanded,
    }))
  )
  const {inboxHasLoaded, inboxLayout, inboxNumSmallRows, inboxRefresh} = chatState
  const {
    queueMetaToRequest,
    setInboxNumSmallRows,
    smallTeamBadgeCount,
    smallTeamsExpanded,
    toggleSmallTeamsExpanded,
  } = chatState

  const {
    allowShowFloatingButton,
    rows: inboxRows,
    smallTeamsExpanded: showAllSmallTeams,
  } = buildInboxRows(inboxLayout, inboxNumSmallRows, smallTeamsExpanded)

  const appendNewChatBuilder = C.Router2.appendNewChatBuilder
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
    if (!C.isPhone && !inboxHasLoaded) {
      inboxRefresh('componentNeverLoaded')
    }
  })

  C.Router2.useSafeFocusEffect(() => {
    if (!inboxHasLoaded) {
      inboxRefresh('componentNeverLoaded')
    }
  })

  React.useEffect(() => {
    const ready = loggedIn && !!username
    const shouldRetry = !inboxHasLoaded && ready && (!C.isMobile || isFocused)
    if (shouldRetry) {
      inboxRefresh('componentNeverLoaded')
    }
  }, [inboxHasLoaded, inboxRefresh, isFocused, loggedIn, username])

  // Compute unread big indices at render time from per-convo stores
  const bigConvIds = React.useMemo(() => {
    return inboxRows.map(r => (r.type === 'big' ? r.conversationIDKey : ''))
  }, [inboxRows])

  const visibleSmallConvIDs = React.useMemo(() => {
    return inboxRows.reduce<Array<string>>((acc, row) => {
      if (row.type === 'small') {
        acc.push(row.conversationIDKey)
      }
      return acc
    }, [])
  }, [inboxRows])

  const unreadIndices = Chat.useChatState(
    C.useShallow(s => {
      return s.getUnreadIndicies(bigConvIds)
    })
  )

  let visibleBadges = 0
  for (const conversationIDKey of visibleSmallConvIDs) {
    visibleBadges += Chat.getConvoState(conversationIDKey).badge
  }
  const hiddenSmallBadgeCount = Math.max(0, smallTeamBadgeCount - visibleBadges)

  let unreadTotal = 0
  unreadIndices.forEach(count => {
    unreadTotal += count
  })

  // Filter out the selected conversation
  let filteredIndices = unreadIndices
  let filteredTotal = unreadTotal
  if (selectedConversationIDKey !== Chat.noConversationIDKey && unreadIndices.size) {
    const filtered = new Map<number, number>()
    filteredTotal = 0
    unreadIndices.forEach((badge, idx) => {
      const row = inboxRows[idx]
      if (row?.type === 'big' && row.conversationIDKey !== selectedConversationIDKey) {
        filtered.set(idx, badge)
        filteredTotal += badge
      }
    })
    filteredIndices = filtered
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
    smallTeamsExpanded: showAllSmallTeams,
    smallTeamsHiddenBadgeCount: hiddenSmallBadgeCount,
    toggleSmallTeamsExpanded,
    unreadIndices: filteredIndices,
    unreadTotal: filteredTotal,
  }
}
