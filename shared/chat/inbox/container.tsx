import * as C from '../../constants'
import * as React from 'react'
import * as Container from '../../util/container'
import * as Constants from '../../constants/chat2'
import * as Types from '../../constants/types/chat2'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import Inbox, {type Props} from '.'
import {appendNewChatBuilder} from '../../actions/typed-routes'
import {useIsFocused} from '@react-navigation/core'
import isEqual from 'lodash/isEqual'

type OwnProps = {
  navKey: string
  conversationIDKey?: Types.ConversationIDKey
}

const makeBigRows = (
  bigTeams: Array<RPCChatTypes.UIInboxBigTeamRow>,
  selectedConversationIDKey: Types.ConversationIDKey
): Array<Types.ChatInboxRowItemBig | Types.ChatInboxRowItemBigHeader | Types.ChatInboxRowItemTeamBuilder> => {
  return bigTeams.map(t => {
    switch (t.state) {
      case RPCChatTypes.UIInboxBigTeamRowTyp.channel: {
        const conversationIDKey = Types.stringToConversationIDKey(t.channel.convID)
        return {
          channelname: t.channel.channelname,
          conversationIDKey,
          isMuted: t.channel.isMuted,
          selected: conversationIDKey === selectedConversationIDKey,
          snippetDecoration: RPCChatTypes.SnippetDecoration.none,
          teamname: t.channel.teamname,
          type: 'big',
        }
      }
      case RPCChatTypes.UIInboxBigTeamRowTyp.label:
        return {
          snippetDecoration: RPCChatTypes.SnippetDecoration.none,
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
  smallTeams: Array<RPCChatTypes.UIInboxSmallTeamRow>,
  selectedConversationIDKey: Types.ConversationIDKey
): Array<Types.ChatInboxRowItemSmall | Types.ChatInboxRowItemTeamBuilder> => {
  return smallTeams.map(t => {
    const conversationIDKey = Types.stringToConversationIDKey(t.convID)
    return {
      conversationIDKey,
      isTeam: t.isTeam,
      selected: conversationIDKey === selectedConversationIDKey,
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
  'isSearching' | 'navKey' | 'neverLoaded' | 'rows' | 'smallTeamsExpanded' | 'unreadIndices' | 'unreadTotal'
>

const InboxWrapper = React.memo(function InboxWrapper(props: WrapperProps) {
  const dispatch = Container.useDispatch()
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

  // a hack to have it check for marked as read when we mount as the focus events don't fire always
  const onNewChat = React.useCallback(() => {
    appendNewChatBuilder()
  }, [])
  const onUntrustedInboxVisible = queueMetaToRequest

  const setInboxNumSmallRows = C.useChatState(s => s.dispatch.setInboxNumSmallRows)
  const toggleSmallTeamsExpanded = C.useChatState(s => s.dispatch.toggleSmallTeamsExpanded)
  const [lastIsFocused, setLastIsFocused] = React.useState(isFocused)

  if (lastIsFocused !== isFocused) {
    setLastIsFocused(isFocused)
    if (Container.isMobile) {
      if (isFocused && Constants.isSplit) {
        dispatch(Chat2Gen.createTabSelected())
      }
    }
  }

  const inboxRefresh = C.useChatState(s => s.dispatch.inboxRefresh)

  Container.useOnMountOnce(() => {
    if (!Container.isMobile) {
      // On mobile this is taken care of by NavigationEvents.
      dispatch(Chat2Gen.createTabSelected())
    }
    if (!inboxHasLoaded) {
      inboxRefresh('componentNeverLoaded')
    }
  })

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
  const _selectedConversationIDKey = conversationIDKey ?? C.noConversationIDKey
  const isSearching = C.useChatState(s => !!s.inboxSearch)
  const smallTeamsExpanded = C.useChatState(s => s.smallTeamsExpanded)
  const {navKey} = ownProps
  const bigTeams = _inboxLayout ? _inboxLayout.bigTeams || [] : []
  const showAllSmallRows = smallTeamsExpanded || !bigTeams.length
  let smallTeams = _inboxLayout ? _inboxLayout.smallTeams || [] : []
  const smallTeamsBelowTheFold = !showAllSmallRows && smallTeams.length > inboxNumSmallRows
  if (!showAllSmallRows) {
    smallTeams = smallTeams.slice(0, inboxNumSmallRows)
  }
  const smallRows = makeSmallRows(smallTeams, _selectedConversationIDKey)
  const bigRows = makeBigRows(bigTeams, _selectedConversationIDKey)
  const teamBuilder: Types.ChatInboxRowItemTeamBuilder = {type: 'teamBuilder'}

  const hasAllSmallTeamConvs =
    (_inboxLayout?.smallTeams?.length ?? 0) === (_inboxLayout?.totalSmallTeams ?? 0)
  const divider: Array<Types.ChatInboxRowItemDivider | Types.ChatInboxRowItemTeamBuilder> =
    bigRows.length !== 0 || !hasAllSmallTeamConvs
      ? [{showButton: !hasAllSmallTeamConvs || smallTeamsBelowTheFold, type: 'divider'}]
      : []
  if (smallRows.length !== 0) {
    if (bigRows.length === 0) {
      if (divider.length !== 0) {
        divider.push(teamBuilder)
      } else {
        smallRows.push(teamBuilder)
      }
    } else {
      bigRows.push(teamBuilder)
    }
  }
  const nextRows: Array<Types.ChatInboxRowItem> = [...smallRows, ...divider, ...bigRows]
  let rows = nextRows
  // TODO better fix later
  if (isEqual(rows, cachedRows)) {
    rows = cachedRows
  }
  cachedRows = rows

  const unreadIndices: Map<number, number> = new Map()
  let unreadTotal: number = 0
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i]!
    if (row.type === 'big') {
      if (
        row.conversationIDKey &&
        _badgeMap.get(row.conversationIDKey) &&
        row.conversationIDKey !== _selectedConversationIDKey
      ) {
        // on mobile include all convos, on desktop only not currently selected convo
        const unreadCount = _badgeMap.get(row.conversationIDKey) || 0
        unreadIndices.set(i, unreadCount)
        unreadTotal += unreadCount
      }
    }
  }
  const props = {
    isSearching,
    navKey,
    neverLoaded,
    rows,
    smallTeamsExpanded: smallTeamsExpanded || bigTeams.length === 0,
    unreadIndices: unreadIndices.size ? unreadIndices : emptyMap,
    unreadTotal,
  }
  return <InboxWrapper {...props} />
}

let cachedRows: Array<Types.ChatInboxRowItem> = []
const emptyMap = new Map()

export default Connected
