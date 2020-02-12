import * as React from 'react'
import * as Container from '../../util/container'
import * as Constants from '../../constants/chat2'
import * as Types from '../../constants/types/chat2'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import {appendNewChatBuilder} from '../../actions/typed-routes'
import Inbox from '.'
import {isPhone} from '../../constants/platform'
import {
  Props as _Props,
  RowItemSmall,
  RowItemBig,
  RowItemBigHeader,
  RowItemDivider,
  RowItemTeamBuilder,
  RowItem,
} from '.'
import * as Kb from '../../common-adapters'
import {HeaderNewChatButton} from './new-chat-button'

type OwnProps = {
  navKey: string
}

const makeBigRows = (
  bigTeams: Array<RPCChatTypes.UIInboxBigTeamRow>
): Array<RowItemBig | RowItemBigHeader | RowItemTeamBuilder> => {
  return bigTeams.map(t => {
    switch (t.state) {
      case RPCChatTypes.UIInboxBigTeamRowTyp.channel:
        return {
          channelname: t.channel.channelname,
          conversationIDKey: Types.stringToConversationIDKey(t.channel.convID),
          isMuted: t.channel.isMuted,
          snippetDecoration: RPCChatTypes.SnippetDecoration.none,
          teamname: t.channel.teamname,
          type: 'big',
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
  smallTeams: Array<RPCChatTypes.UIInboxSmallTeamRow>
): Array<RowItemSmall | RowItemTeamBuilder> => {
  return smallTeams.map(t => {
    return {
      conversationIDKey: Types.stringToConversationIDKey(t.convID),
      isTeam: t.isTeam,
      snippet: t.snippet || undefined,
      snippetDecoration: t.snippetDecoration,
      teamname: t.name,
      time: t.time,
      type: 'small',
    }
  })
}

type Props = {
  _hasLoadedTrusted: boolean
  _onInitialLoad: (array: Array<Types.ConversationIDKey>) => void
  _refreshInbox: () => void
  _canRefreshOnMount: boolean
  _onBecomeVisible: () => void
} & _Props

export class InboxWrapper extends React.PureComponent<Props> {
  static navigationOptions = {
    header: undefined,
    headerRight: <HeaderNewChatButton />,
    headerTitle: () => (
      <Kb.Text type="BodyBig" lineClamp={1}>
        {' '}
        Chats{' '}
      </Kb.Text>
    ),
    title: 'Chats',
  }

  _onDidFocus = () => {
    this.props._onBecomeVisible()
  }

  componentDidMount() {
    if (!Container.isMobile) {
      // On mobile this is taken care of by NavigationEvents.
      this.props._onBecomeVisible()
    }
    if (this.props._canRefreshOnMount) {
      this.props._refreshInbox()
    }
    if (!this.props._hasLoadedTrusted && this.props.rows.length) {
      const toUnbox = this.props.rows.slice(0, 20).reduce<Array<Types.ConversationIDKey>>((arr, row) => {
        if (row.type === 'small') {
          arr.push(row.conversationIDKey)
        }
        return arr
      }, [])
      if (toUnbox.length) {
        this.props._onInitialLoad(toUnbox)
      }
    }
  }

  render() {
    const {
      _hasLoadedTrusted,
      _refreshInbox,
      _onInitialLoad,
      _canRefreshOnMount,
      _onBecomeVisible,
      ...rest
    } = this.props
    return (
      <>
        {Container.isMobile && <Kb.NavigationEvents onDidFocus={this._onDidFocus} />}
        <Inbox {...rest} />
      </>
    )
  }
}

const Connected = Container.namedConnect(
  state => {
    const {inboxLayout, inboxHasLoaded} = state.chat2
    let {inboxNumSmallRows} = state.chat2
    if (inboxNumSmallRows === undefined) {
      inboxNumSmallRows = 5
    }
    const neverLoaded = !inboxHasLoaded
    const allowShowFloatingButton = inboxLayout
      ? (inboxLayout.smallTeams || []).length > inboxNumSmallRows && !!(inboxLayout.bigTeams || []).length
      : false
    return {
      _badgeMap: state.chat2.badgeMap,
      _canRefreshOnMount: neverLoaded,
      _hasLoadedTrusted: state.chat2.trustedInboxHasLoaded,
      _inboxLayout: inboxLayout,
      _selectedConversationIDKey: state.chat2.selectedConversation,
      allowShowFloatingButton,
      inboxNumSmallRows,
      isLoading: isPhone ? Constants.anyChatWaitingKeys(state) : false, // desktop doesn't use isLoading so ignore it
      isSearching: !!state.chat2.inboxSearch,
      neverLoaded,
      smallTeamsExpanded: state.chat2.smallTeamsExpanded,
    }
  },
  dispatch => ({
    _onBecomeVisible: () => {
      if (Container.chatSplit) {
        dispatch(Chat2Gen.createTabSelected())
      }
    },
    // a hack to have it check for marked as read when we mount as the focus events don't fire always
    _onInitialLoad: (conversationIDKeys: Array<Types.ConversationIDKey>) =>
      dispatch(Chat2Gen.createMetaNeedsUpdating({conversationIDKeys, reason: 'initialTrustedLoad'})),
    _refreshInbox: () => dispatch(Chat2Gen.createInboxRefresh({reason: 'componentNeverLoaded'})),
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
    let smallRows = makeSmallRows(smallTeams)
    let bigRows = makeBigRows(bigTeams)
    const teamBuilder: RowItemTeamBuilder = {type: 'teamBuilder'}

    const hasAllSmallTeamConvs =
      (stateProps._inboxLayout?.smallTeams?.length ?? 0) === (stateProps._inboxLayout?.totalSmallTeams ?? 0)
    const divider: Array<RowItemDivider | RowItemTeamBuilder> =
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
    const rows: Array<RowItem> = [...smallRows, ...divider, ...bigRows]

    const unreadIndices: Array<number> = []
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
        unreadIndices.unshift(i)
      }
    }

    return {
      _canRefreshOnMount: stateProps._canRefreshOnMount,
      _hasLoadedTrusted: stateProps._hasLoadedTrusted,
      _onBecomeVisible: dispatchProps._onBecomeVisible,
      _onInitialLoad: dispatchProps._onInitialLoad,
      _refreshInbox: dispatchProps._refreshInbox,
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
    }
  },
  'Inbox'
)(InboxWrapper)

export default Connected
