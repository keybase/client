import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import * as React from 'react'
import * as T from '@/constants/types'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {useIsFocused} from '@react-navigation/core'
import {buildInboxRows} from './rows'

export function useInboxState(conversationIDKey?: string, isSearching = false) {
  const isFocused = useIsFocused()
  const loggedIn = useConfigState(s => s.loggedIn)
  const username = useCurrentUserState(s => s.username)
  const loadInboxNumSmallRows = C.useRPC(T.RPCGen.configGuiGetValueRpcPromise)

  const chatState = Chat.useChatState(
    C.useShallow(s => ({
      inboxHasLoaded: s.inboxHasLoaded,
      inboxLayout: s.inboxLayout,
      inboxRefresh: s.dispatch.inboxRefresh,
      queueMetaToRequest: s.dispatch.queueMetaToRequest,
    }))
  )
  const {inboxHasLoaded, inboxLayout, inboxRefresh, queueMetaToRequest} = chatState
  const [inboxNumSmallRows, setInboxNumSmallRowsState] = React.useState(5)
  const [smallTeamsExpanded, setSmallTeamsExpanded] = React.useState(false)

  const setInboxNumSmallRows = React.useCallback((rows: number, persist = true) => {
    if (rows <= 0) {
      return
    }
    setInboxNumSmallRowsState(rows)
    if (!persist) {
      return
    }
    const f = async () => {
      try {
        await T.RPCGen.configGuiSetValueRpcPromise({
          path: 'ui.inboxSmallRows',
          value: {i: rows, isNull: false},
        })
      } catch {}
    }
    C.ignorePromise(f())
  }, [])
  const toggleSmallTeamsExpanded = React.useCallback(() => {
    setSmallTeamsExpanded(expanded => !expanded)
  }, [])

  const {allowShowFloatingButton, rows: inboxRows, smallTeamsExpanded: showAllSmallTeams} = React.useMemo(
    () => buildInboxRows(inboxLayout, inboxNumSmallRows, smallTeamsExpanded),
    [inboxLayout, inboxNumSmallRows, smallTeamsExpanded]
  )

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

  React.useEffect(() => {
    let canceled = false
    loadInboxNumSmallRows(
      [{path: 'ui.inboxSmallRows'}],
      rows => {
        if (canceled) {
          return
        }
        const count = rows.i ?? -1
        if (count > 0) {
          setInboxNumSmallRows(count, false)
        }
      },
      () => {}
    )
    return () => {
      canceled = true
    }
  }, [loadInboxNumSmallRows, setInboxNumSmallRows])

  const retriedEmptyInboxRef = React.useRef(false)
  React.useEffect(() => {
    const ready = loggedIn && !!username && (!C.isMobile || isFocused)
    if (!ready || isSearching || !inboxHasLoaded || inboxRows.length > 0 || retriedEmptyInboxRef.current) {
      return
    }
    retriedEmptyInboxRef.current = true
    inboxRefresh('inboxSyncedCurrentButEmpty')
  }, [inboxHasLoaded, inboxRefresh, inboxRows.length, isFocused, isSearching, loggedIn, username])

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

  const hiddenSmallBadgeCount = Chat.useChatState(s => {
    let visibleBadges = 0
    for (const conversationIDKey of visibleSmallConvIDs) {
      visibleBadges += Chat.getConvoState(conversationIDKey).badge
    }
    return Math.max(0, s.smallTeamBadgeCount - visibleBadges)
  })

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
