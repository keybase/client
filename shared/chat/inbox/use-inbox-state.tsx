import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import * as ConvoState from '@/stores/convostate'
import * as React from 'react'
import * as T from '@/constants/types'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {useInboxRowsState} from '@/stores/inbox-rows'
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
      inboxRetriedOnCurrentEmpty: s.inboxRetriedOnCurrentEmpty,
      setInboxRetriedOnCurrentEmpty: s.dispatch.setInboxRetriedOnCurrentEmpty,
    }))
  )
  const {
    inboxHasLoaded,
    inboxLayout,
    inboxRefresh,
    inboxRetriedOnCurrentEmpty,
    setInboxRetriedOnCurrentEmpty,
  } = chatState
  const [inboxNumSmallRows, setInboxNumSmallRowsState] = React.useState(5)
  const [smallTeamsExpanded, setSmallTeamsExpanded] = React.useState(false)
  const inboxNumSmallRowsLoadVersionRef = React.useRef(0)
  const inboxNumSmallRowsLoadedRef = React.useRef(false)
  const inboxNumSmallRowsUserChangedRef = React.useRef(false)

  React.useEffect(() => {
    setInboxNumSmallRowsState(5)
    setSmallTeamsExpanded(false)
    inboxNumSmallRowsLoadedRef.current = false
    inboxNumSmallRowsUserChangedRef.current = false
  }, [username])

  const setInboxNumSmallRows = (rows: number, persist = true) => {
    if (rows <= 0) {
      return
    }
    inboxNumSmallRowsLoadedRef.current = true
    inboxNumSmallRowsUserChangedRef.current = true
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
  }
  const toggleSmallTeamsExpanded = () => {
    setSmallTeamsExpanded(expanded => !expanded)
  }

  const {
    allowShowFloatingButton,
    rows: inboxRows,
    smallTeamsExpanded: showAllSmallTeams,
  } = React.useMemo(
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
      ConvoState.getConvoState(Chat.getSelectedConversation()).dispatch.tabSelected()
    }
  }, [isFocused])

  C.useOnMountOnce(() => {
    if (!C.isMobile) {
      ConvoState.getConvoState(Chat.getSelectedConversation()).dispatch.tabSelected()
    }
    if (!C.isPhone && !inboxHasLoaded) {
      C.ignorePromise(inboxRefresh('componentNeverLoaded'))
    }
  })

  C.Router2.useSafeFocusEffect(() => {
    if (!inboxHasLoaded) {
      C.ignorePromise(inboxRefresh('componentNeverLoaded'))
    }
  })

  React.useEffect(() => {
    const ready = loggedIn && !!username
    const shouldRetry = !inboxHasLoaded && ready && (!C.isMobile || isFocused)
    if (shouldRetry) {
      C.ignorePromise(inboxRefresh('componentNeverLoaded'))
    }
  }, [inboxHasLoaded, inboxRefresh, isFocused, loggedIn, username])

  React.useEffect(() => {
    const ready = loggedIn && !!username
    if (!ready) {
      return
    }
    if (inboxNumSmallRowsLoadedRef.current) {
      return
    }
    const loadVersion = inboxNumSmallRowsLoadVersionRef.current + 1
    inboxNumSmallRowsLoadVersionRef.current = loadVersion
    loadInboxNumSmallRows(
      [{path: 'ui.inboxSmallRows'}],
      rows => {
        if (
          inboxNumSmallRowsLoadVersionRef.current !== loadVersion ||
          inboxNumSmallRowsUserChangedRef.current
        ) {
          return
        }
        inboxNumSmallRowsLoadedRef.current = true
        const count = rows.i ?? -1
        if (count > 0) {
          setInboxNumSmallRowsState(count)
        }
      },
      () => {
        if (inboxNumSmallRowsLoadVersionRef.current !== loadVersion) {
          return
        }
        inboxNumSmallRowsLoadedRef.current = true
      }
    )
    return () => {
      if (inboxNumSmallRowsLoadVersionRef.current === loadVersion) {
        inboxNumSmallRowsLoadVersionRef.current++
      }
    }
  }, [loadInboxNumSmallRows, loggedIn, username])

  React.useEffect(() => {
    const ready = loggedIn && !!username && (!C.isMobile || isFocused)
    if (!ready || isSearching || !inboxHasLoaded || inboxRows.length > 0 || inboxRetriedOnCurrentEmpty) {
      return
    }
    setInboxRetriedOnCurrentEmpty(true)
    C.ignorePromise(inboxRefresh('inboxSyncedCurrentButEmpty'))
  }, [
    inboxHasLoaded,
    inboxRefresh,
    inboxRetriedOnCurrentEmpty,
    inboxRows.length,
    isFocused,
    isSearching,
    loggedIn,
    setInboxRetriedOnCurrentEmpty,
    username,
  ])

  // Compute unread big indices at render time from per-convo stores
  const bigConvIds = React.useMemo(() => {
    return inboxRows.map(r => (r.type === 'big' ? r.conversationIDKey : ''))
  }, [inboxRows])

  const unreadBadges = useInboxRowsState(
    C.useShallow(s =>
      bigConvIds.map(conversationIDKey =>
        conversationIDKey ? (s.rowsBig.get(conversationIDKey)?.badgeCount ?? 0) : 0
      )
    )
  )

  const unreadIndices = React.useMemo(() => {
    const next: Map<number, number> = new Map()
    unreadBadges.forEach((badge, idx) => {
      if (badge > 0) {
        next.set(idx, badge)
      }
    })
    return next
  }, [unreadBadges])

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
    onUntrustedInboxVisible: ConvoState.queueMetaToRequest,
    rows: inboxRows,
    selectedConversationIDKey,
    setInboxNumSmallRows,
    smallTeamsExpanded: showAllSmallTeams,
    toggleSmallTeamsExpanded,
    unreadIndices: filteredIndices,
    unreadTotal: filteredTotal,
  }
}
