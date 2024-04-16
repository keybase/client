import * as C from '@/constants'
import * as React from 'react'
import * as T from '@/constants/types'
import Inbox, {type Props} from '.'
import {useIsFocused} from '@react-navigation/core'
import isEqual from 'lodash/isEqual'

type OwnProps = {
  navKey: string
  conversationIDKey?: T.Chat.ConversationIDKey
}

const makeBigRows = (
  bigTeams: ReadonlyArray<T.RPCChat.UIInboxBigTeamRow>
): Array<
  T.Chat.ChatInboxRowItemBig | T.Chat.ChatInboxRowItemBigHeader | T.Chat.ChatInboxRowItemTeamBuilder
> => {
  return bigTeams.map(t => {
    switch (t.state) {
      case T.RPCChat.UIInboxBigTeamRowTyp.channel: {
        const conversationIDKey = T.Chat.stringToConversationIDKey(t.channel.convID)
        return {
          channelname: t.channel.channelname,
          conversationIDKey,
          isMuted: t.channel.isMuted,
          snippetDecoration: T.RPCChat.SnippetDecoration.none,
          teamname: t.channel.teamname,
          type: 'big',
        }
      }
      case T.RPCChat.UIInboxBigTeamRowTyp.label:
        return {
          snippetDecoration: T.RPCChat.SnippetDecoration.none,
          teamID: t.label.id,
          teamname: t.label.name,
          type: 'bigHeader',
        }
      default:
        throw new Error('unknown row typ')
    }
  })
}

const makeSmallRows = (
  smallTeams: ReadonlyArray<T.RPCChat.UIInboxSmallTeamRow>
): Array<T.Chat.ChatInboxRowItemSmall | T.Chat.ChatInboxRowItemTeamBuilder> => {
  return smallTeams.map(t => {
    const conversationIDKey = T.Chat.stringToConversationIDKey(t.convID)
    return {
      conversationIDKey,
      isTeam: t.isTeam,
      snippet: t.snippet || undefined,
      snippetDecoration: t.snippetDecoration,
      teamname: t.name,
      time: t.time,
      type: 'small',
    }
  })
}

type WrapperProps = Pick<
  Props,
  | 'isSearching'
  | 'navKey'
  | 'neverLoaded'
  | 'rows'
  | 'smallTeamsExpanded'
  | 'unreadIndices'
  | 'unreadTotal'
  | 'selectedConversationIDKey'
>

const InboxWrapper = React.memo(function InboxWrapper(props: WrapperProps) {
  const inboxHasLoaded = C.useChatState(s => s.inboxHasLoaded)
  const queueMetaToRequest = C.useChatState(s => s.dispatch.queueMetaToRequest)
  const isFocused = useIsFocused()
  const inboxNumSmallRows = C.useChatState(s => s.inboxNumSmallRows ?? 5)
  const allowShowFloatingButton = C.useChatState(s => {
    const {inboxLayout} = s
    const inboxNumSmallRows = s.inboxNumSmallRows ?? 5
    return inboxLayout
      ? (inboxLayout.smallTeams || []).length > inboxNumSmallRows && !!(inboxLayout.bigTeams || []).length
      : false
  })

  const appendNewChatBuilder = C.useRouterState(s => s.appendNewChatBuilder)
  // a hack to have it check for marked as read when we mount as the focus events don't fire always
  const onNewChat = appendNewChatBuilder
  const onUntrustedInboxVisible = queueMetaToRequest

  const setInboxNumSmallRows = C.useChatState(s => s.dispatch.setInboxNumSmallRows)
  const toggleSmallTeamsExpanded = C.useChatState(s => s.dispatch.toggleSmallTeamsExpanded)
  const [lastIsFocused, setLastIsFocused] = React.useState(isFocused)

  if (lastIsFocused !== isFocused) {
    setLastIsFocused(isFocused)
    if (C.isMobile) {
      if (isFocused && C.Chat.isSplit) {
        setTimeout(() => {
          C.getConvoState(C.Chat.getSelectedConversation()).dispatch.tabSelected()
        }, 0)
      }
    }
  }

  const inboxRefresh = C.useChatState(s => s.dispatch.inboxRefresh)

  C.useOnMountOnce(() => {
    if (!C.isMobile) {
      // On mobile this is taken care of by NavigationEvents.
      C.getConvoState(C.Chat.getSelectedConversation()).dispatch.tabSelected()
    }
    if (!inboxHasLoaded) {
      inboxRefresh('componentNeverLoaded')
    }
  })

  C.Router2.useSafeFocusEffect(
    React.useCallback(() => {
      if (!inboxHasLoaded) {
        inboxRefresh('componentNeverLoaded')
      }
    }, [inboxHasLoaded, inboxRefresh])
  )

  return (
    <Inbox
      {...props}
      allowShowFloatingButton={allowShowFloatingButton}
      onNewChat={onNewChat}
      onUntrustedInboxVisible={onUntrustedInboxVisible}
      setInboxNumSmallRows={setInboxNumSmallRows}
      toggleSmallTeamsExpanded={toggleSmallTeamsExpanded}
      inboxNumSmallRows={inboxNumSmallRows}
    />
  )
})

const noSmallTeams = new Array<T.RPCChat.UIInboxSmallTeamRow>()
const noBigTeams = new Array<T.RPCChat.UIInboxBigTeamRow>()
const Connected = (ownProps: OwnProps) => {
  const inboxLayout = C.useChatState(s => s.inboxLayout)
  const inboxHasLoaded = C.useChatState(s => s.inboxHasLoaded)
  const {conversationIDKey} = ownProps
  const neverLoaded = !inboxHasLoaded
  const inboxNumSmallRows = C.useChatState(s => s.inboxNumSmallRows ?? 5)
  const badgeCountsChanged = C.useChatState(s => s.badgeCountsChanged)
  const _badgeMap = React.useMemo(() => {
    return C.useChatState.getState().getBadgeMap(badgeCountsChanged)
  }, [badgeCountsChanged])
  const _inboxLayout = inboxLayout
  const selectedConversationIDKey = conversationIDKey ?? C.Chat.noConversationIDKey
  const isSearching = C.useChatState(s => !!s.inboxSearch)
  const smallTeamsExpanded = C.useChatState(s => s.smallTeamsExpanded)
  const {navKey} = ownProps
  const bigTeams = _inboxLayout ? _inboxLayout.bigTeams || noBigTeams : noBigTeams
  const showAllSmallRows = smallTeamsExpanded || !bigTeams.length
  const allSmallTeams = _inboxLayout ? _inboxLayout.smallTeams || noSmallTeams : noSmallTeams
  const smallTeamsBelowTheFold = !showAllSmallRows && allSmallTeams.length > inboxNumSmallRows
  const smallTeams = React.useMemo(() => {
    if (!showAllSmallRows) {
      return allSmallTeams.slice(0, inboxNumSmallRows)
    } else {
      return allSmallTeams
    }
  }, [showAllSmallRows, inboxNumSmallRows, allSmallTeams])
  const smallRows = React.useMemo(() => {
    return makeSmallRows(smallTeams)
  }, [smallTeams])

  const bigRows = React.useMemo(() => {
    return makeBigRows(bigTeams)
  }, [bigTeams])

  const hasAllSmallTeamConvs =
    (_inboxLayout?.smallTeams?.length ?? 0) === (_inboxLayout?.totalSmallTeams ?? 0)
  const divider: Array<T.Chat.ChatInboxRowItemDivider | T.Chat.ChatInboxRowItemTeamBuilder> =
    bigRows.length !== 0 || !hasAllSmallTeamConvs
      ? [{showButton: !hasAllSmallTeamConvs || smallTeamsBelowTheFold, type: 'divider'}]
      : []

  const builderAfterSmall = new Array<T.Chat.ChatInboxRowItemTeamBuilder>()
  const builderAfterDivider = new Array<T.Chat.ChatInboxRowItemTeamBuilder>()
  const builderAfterBig = new Array<T.Chat.ChatInboxRowItemTeamBuilder>()
  const teamBuilder: T.Chat.ChatInboxRowItemTeamBuilder = {type: 'teamBuilder'}
  if (smallRows.length !== 0) {
    if (bigRows.length === 0) {
      if (divider.length !== 0) {
        builderAfterDivider.push(teamBuilder)
      } else {
        builderAfterSmall.push(teamBuilder)
      }
    } else {
      builderAfterBig.push(teamBuilder)
    }
  }
  const nextRows: Array<T.Chat.ChatInboxRowItem> = [
    ...smallRows,
    ...builderAfterSmall,
    ...divider,
    ...builderAfterDivider,
    ...bigRows,
    ...builderAfterBig,
  ]
  let rows = nextRows

  const cachedRowsRef = React.useRef<Array<T.Chat.ChatInboxRowItem>>([])

  // TODO better fix later
  if (isEqual(rows, cachedRowsRef.current)) {
    rows = cachedRowsRef.current
  }
  cachedRowsRef.current = rows

  const _unreadIndices: Map<number, number> = new Map()
  let unreadTotal: number = 0
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i]!
    if (row.type === 'big') {
      if (
        row.conversationIDKey &&
        _badgeMap.get(row.conversationIDKey) &&
        row.conversationIDKey !== selectedConversationIDKey
      ) {
        // on mobile include all convos, on desktop only not currently selected convo
        const unreadCount = _badgeMap.get(row.conversationIDKey) || 0
        _unreadIndices.set(i, unreadCount)
        unreadTotal += unreadCount
      }
    }
  }

  const unreadIndiciesRef = React.useRef(_unreadIndices)
  if (!isEqual(unreadIndiciesRef.current, _unreadIndices)) {
    unreadIndiciesRef.current = _unreadIndices
  }
  const unreadIndices = unreadIndiciesRef.current

  const props = {
    isSearching,
    navKey,
    neverLoaded,
    rows,
    selectedConversationIDKey,
    smallTeamsExpanded: smallTeamsExpanded || bigTeams.length === 0,
    unreadIndices: unreadIndices.size ? unreadIndices : emptyMap,
    unreadTotal,
  }
  return <InboxWrapper {...props} />
}

const emptyMap = new Map()

export default Connected
