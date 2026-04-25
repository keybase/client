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

export function useInboxState(
  conversationIDKey?: string,
  isSearching = false,
  refreshInbox?: T.Chat.ChatRootInboxRefresh
) {
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
  const [inboxControls, setInboxControls] = React.useState(() => ({
    inboxNumSmallRows: 5,
    inboxNumSmallRowsLoaded: false,
    inboxNumSmallRowsUserChanged: false,
    smallTeamsExpanded: false,
    username,
  }))
  const controlsMatchUser = inboxControls.username === username
  const inboxNumSmallRows = controlsMatchUser ? inboxControls.inboxNumSmallRows : 5
  const inboxNumSmallRowsLoaded = controlsMatchUser ? inboxControls.inboxNumSmallRowsLoaded : false
  const smallTeamsExpanded = controlsMatchUser ? inboxControls.smallTeamsExpanded : false
  const inboxNumSmallRowsLoadVersionRef = React.useRef(0)

  const setInboxNumSmallRows = (rows: number, persist = true) => {
    if (rows <= 0) {
      return
    }
    setInboxControls(state => ({
      inboxNumSmallRows: rows,
      inboxNumSmallRowsLoaded: true,
      inboxNumSmallRowsUserChanged: true,
      smallTeamsExpanded: state.username === username ? state.smallTeamsExpanded : false,
      username,
    }))
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
    setInboxControls(state => ({
      inboxNumSmallRows: state.username === username ? state.inboxNumSmallRows : 5,
      inboxNumSmallRowsLoaded: state.username === username ? state.inboxNumSmallRowsLoaded : false,
      inboxNumSmallRowsUserChanged:
        state.username === username ? state.inboxNumSmallRowsUserChanged : false,
      smallTeamsExpanded: !(state.username === username ? state.smallTeamsExpanded : false),
      username,
    }))
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
  const handledRefreshNonceRef = React.useRef('')
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

  React.useEffect(() => {
    const ready = loggedIn && !!username && (!C.isMobile || isFocused)
    if (!ready || !refreshInbox || handledRefreshNonceRef.current === refreshInbox.nonce) {
      return
    }
    handledRefreshNonceRef.current = refreshInbox.nonce
    C.ignorePromise(inboxRefresh(refreshInbox.reason))
    C.Router2.setChatRootParams({refreshInbox: undefined})
  }, [inboxRefresh, isFocused, loggedIn, refreshInbox, username])

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
    if (inboxNumSmallRowsLoaded) {
      return
    }
    const loadVersion = inboxNumSmallRowsLoadVersionRef.current + 1
    inboxNumSmallRowsLoadVersionRef.current = loadVersion
    loadInboxNumSmallRows(
      [{path: 'ui.inboxSmallRows'}],
      rows => {
        if (inboxNumSmallRowsLoadVersionRef.current !== loadVersion) {
          return
        }
        const count = rows.i ?? -1
        setInboxControls(state => {
          if (state.username === username && state.inboxNumSmallRowsUserChanged) {
            return state
          }
          return {
            inboxNumSmallRows:
              count > 0 ? count : state.username === username ? state.inboxNumSmallRows : 5,
            inboxNumSmallRowsLoaded: true,
            inboxNumSmallRowsUserChanged: false,
            smallTeamsExpanded: state.username === username ? state.smallTeamsExpanded : false,
            username,
          }
        })
      },
      () => {
        if (inboxNumSmallRowsLoadVersionRef.current !== loadVersion) {
          return
        }
        setInboxControls(state => ({
          inboxNumSmallRows: state.username === username ? state.inboxNumSmallRows : 5,
          inboxNumSmallRowsLoaded: true,
          inboxNumSmallRowsUserChanged:
            state.username === username ? state.inboxNumSmallRowsUserChanged : false,
          smallTeamsExpanded: state.username === username ? state.smallTeamsExpanded : false,
          username,
        }))
      }
    )
    return () => {
      if (inboxNumSmallRowsLoadVersionRef.current === loadVersion) {
        inboxNumSmallRowsLoadVersionRef.current++
      }
    }
  }, [inboxNumSmallRowsLoaded, loadInboxNumSmallRows, loggedIn, username])

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
