import * as React from 'react'
import * as Container from '../../util/container'
import * as Constants from '../../constants/chat2'
import * as Types from '../../constants/types/chat2'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import {appendNewChatBuilder} from '../../actions/typed-routes'
import Inbox from '.'
import {isPhone} from '../../constants/platform'
import {Props} from '.'
import * as Kb from '../../common-adapters'
import {HeaderNewChatButton} from './new-chat-button'
// @ts-ignore
import {withNavigationFocus} from '@react-navigation/core'

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

let InboxWrapper = (props: Props) => {
  const dispatch = Container.useDispatch()
  const inboxHasLoaded = Container.useSelector(state => state.chat2.inboxHasLoaded)

  // temporary until nav 5
  // @ts-ignore
  const {isFocused} = props

  if (Container.isMobile) {
    // eslint-disable-next-line
    React.useEffect(() => {
      if (isFocused && Constants.isSplit) {
        dispatch(Chat2Gen.createTabSelected())
      }
      // eslint-disable-next-line
    }, [isFocused])
  }

  React.useEffect(() => {
    if (!Container.isMobile) {
      // On mobile this is taken care of by NavigationEvents.
      dispatch(Chat2Gen.createTabSelected())
    }
    if (!inboxHasLoaded) {
      dispatch(Chat2Gen.createInboxRefresh({reason: 'componentNeverLoaded'}))
    }
    // we actually only want to run this once, likely we should dispatch a 'inbox saw first'
    // eslint-disable-next-line
  }, [])

  return <Inbox {...props} />
}

// temporary until nav 5
if (Container.isMobile) {
  InboxWrapper = withNavigationFocus(InboxWrapper)
}

// @ts-ignore
InboxWrapper.navigationOptions = {
  header: undefined,
  headerRight: <HeaderNewChatButton />,
  headerTitle: () => (
    <Kb.Text type="BodyBig" lineClamp={1}>
      {' '}
      Chats{' '}
    </Kb.Text>
  ),
}

const Connected = Container.namedConnect(
  (state, ownProps: OwnProps) => {
    const {inboxLayout, inboxHasLoaded} = state.chat2
    let {inboxNumSmallRows} = state.chat2
    if (inboxNumSmallRows === undefined) {
      inboxNumSmallRows = 5
    }
    const {conversationIDKey} = ownProps
    const neverLoaded = !inboxHasLoaded
    const allowShowFloatingButton = inboxLayout
      ? (inboxLayout.smallTeams || []).length > inboxNumSmallRows && !!(inboxLayout.bigTeams || []).length
      : false
    return {
      _badgeMap: state.chat2.badgeMap,
      _hasLoadedTrusted: state.chat2.trustedInboxHasLoaded,
      _inboxLayout: inboxLayout,
      _selectedConversationIDKey: conversationIDKey ?? Constants.noConversationIDKey,
      allowShowFloatingButton,
      inboxNumSmallRows,
      isLoading: isPhone ? Constants.anyChatWaitingKeys(state) : false, // desktop doesn't use isLoading so ignore it
      isSearching: !!state.chat2.inboxSearch,
      neverLoaded,
      smallTeamsExpanded: state.chat2.smallTeamsExpanded,
    }
  },
  dispatch => ({
    // a hack to have it check for marked as read when we mount as the focus events don't fire always
    onNewChat: () => dispatch(appendNewChatBuilder()),
    onUntrustedInboxVisible: (conversationIDKeys: Array<Types.ConversationIDKey>) =>
      dispatch(
        Chat2Gen.createMetaNeedsUpdating({
          conversationIDKeys,
          reason: 'untrusted inbox visible',
        })
      ),
    setInboxNumSmallRows: (rows: number) => dispatch(Chat2Gen.createSetInboxNumSmallRows({rows})),
    toggleSmallTeamsExpanded: () => dispatch(Chat2Gen.createToggleSmallTeamsExpanded()),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const {navKey} = ownProps
    const bigTeams = stateProps._inboxLayout ? stateProps._inboxLayout.bigTeams || [] : []
    const hasBigTeams = !!bigTeams.length
    const showAllSmallRows = stateProps.smallTeamsExpanded || !bigTeams.length
    let smallTeams = stateProps._inboxLayout ? stateProps._inboxLayout.smallTeams || [] : []
    const smallTeamsBelowTheFold = !showAllSmallRows && smallTeams.length > stateProps.inboxNumSmallRows
    if (!showAllSmallRows) {
      smallTeams = smallTeams.slice(0, stateProps.inboxNumSmallRows)
    }
    let smallRows = makeSmallRows(smallTeams, stateProps._selectedConversationIDKey)
    let bigRows = makeBigRows(bigTeams, stateProps._selectedConversationIDKey)
    const teamBuilder: Types.ChatInboxRowItemTeamBuilder = {type: 'teamBuilder'}

    const hasAllSmallTeamConvs =
      (stateProps._inboxLayout?.smallTeams?.length ?? 0) === (stateProps._inboxLayout?.totalSmallTeams ?? 0)
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
    const rows: Array<Types.ChatInboxRowItem> = [...smallRows, ...divider, ...bigRows]

    const unreadIndices: Map<number, number> = new Map()
    let unreadTotal: number = 0
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i]
      if (!['big', 'bigHeader', 'teamBuilder'].includes(row.type)) {
        // only check big teams for large inbox perf
        break
      }
      if (
        row.conversationIDKey &&
        stateProps._badgeMap.get(row.conversationIDKey) &&
        row.conversationIDKey !== stateProps._selectedConversationIDKey
      ) {
        // on mobile include all convos, on desktop only not currently selected convo
        const unreadCount = stateProps._badgeMap.get(row.conversationIDKey) || 0
        unreadIndices.set(i, unreadCount)
        unreadTotal += unreadCount
      }
    }

    return {
      allowShowFloatingButton: stateProps.allowShowFloatingButton,
      hasBigTeams,
      inboxNumSmallRows: stateProps.inboxNumSmallRows,
      isLoading: stateProps.isLoading,
      isSearching: stateProps.isSearching,
      navKey,
      neverLoaded: stateProps.neverLoaded,
      onNewChat: dispatchProps.onNewChat,
      onUntrustedInboxVisible: dispatchProps.onUntrustedInboxVisible,
      rows,
      setInboxNumSmallRows: dispatchProps.setInboxNumSmallRows,
      smallTeamsExpanded: stateProps.smallTeamsExpanded || bigTeams.length === 0,
      toggleSmallTeamsExpanded: dispatchProps.toggleSmallTeamsExpanded,
      unreadIndices,
      unreadTotal,
    }
  },
  'Inbox'
)(InboxWrapper)

export default Connected
